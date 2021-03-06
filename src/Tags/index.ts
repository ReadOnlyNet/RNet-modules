import { Module } from '@rnet.cf/rnet-core';
import * as eris from '@rnet.cf/eris';
import * as rnet from 'RNet';
import * as commands from './commands';

export default class Tags extends Module {
	public module: string = 'Tags';
	public description: string = 'Allow users or some roles to create tags';
	public list: boolean = true;
	public enabled: boolean = true;
	public hasPartial: boolean = true;
	public commands: {} = commands;

	get settings() {
		return {
			limitCreate: Boolean,
			allowedRoles: { type: Array, default: [] },
		};
	}

	public start() {}

	// tslint:disable-next-line:cyclomatic-complexity
	public async createOrEdit(message: eris.Message, tag: string, content: string, guildConfig: rnet.GuildConfig, isEdit?: boolean) {
		const guild = (<eris.GuildChannel>message.channel).guild;
		if (!this.isEnabled(guild, this, guildConfig)) {
			return Promise.reject(null);
		}

		const tagConfig = guildConfig.tags;
		let edit = false;
		let count: number;
		let result: any;

		if (tagConfig && tagConfig.limitCreate) {
			let canCreate = false;
			let canEdit = false;

			if (this.isAdmin(message.member) ||
				this.isServerAdmin(message.member, message.channel) ||
				this.isServerMod(message.member, message.channel)) {
					canCreate = true;
					canEdit = true;
			}

			if (!canEdit && !canCreate) {
				if (tagConfig.allowedRoles && tagConfig.allowedRoles.length) {
					for (const id of message.member.roles) {
						if (tagConfig.allowedRoles.find((r: any) => r.id === id)) {
							canCreate = true;
						}
					}
				}

				if (!canCreate) {
					return Promise.reject(`You don't have permissions to create or edit this tag.`);
				}
			}

			try {
				[count, result] = await Promise.all([
					this.models.Tag.count({ guild: guild.id }),
					this.models.Tag.findOne({ guild: guild.id, tag: tag }).lean().exec(),
				]);
				canEdit = (result && result.author.id === message.member.id) ? true : canEdit;
				if (result) {
					if (!isEdit) {
						return Promise.reject(`That tag already exists.`);
					}
					if (!canEdit) {
						return Promise.reject(`You don't have permissions to edit this tag.`);
					} else {
						edit = true;
					}
				}
			} catch (err) {
				return Promise.reject(`Something went wrong.`);
			}
		} else {
			try {
				count = await this.models.Tag.count({ guild: guild.id });
			} catch (err) {
				return Promise.reject(`Something went wrong.`);
			}
		}

		const doc = {
			guild: guild.id,
			author: message.author.toJSON(),
			tag,
			content,
		};

		if (edit) {
			delete doc.author;
		} else {
			if (count >= (this.globalConfig.maxTags || 6000)) {
				return Promise.reject(`You have created too many tags.`);
			}
		}

		try {
			await this.models.Tag.update({ guild: guild.id, tag: tag }, doc, { upsert: true });
		} catch (err) {
			return Promise.reject(`I can't create that tag.`);
		}

		return Promise.resolve(`Tag ${tag} created.`);
	}

	public async deleteTag(message: eris.Message, _tag: string, guildConfig: rnet.GuildConfig) {
		const guild = (<eris.GuildChannel>message.channel).guild;
		if (!this.isEnabled(guild, this, guildConfig)) {
			return Promise.reject(null);
		}

		let tag;
		try {
			tag = await this.models.Tag.findOne({ guild: guild.id, tag: _tag }).lean().exec();
		} catch (err) {
			return Promise.reject('Something went wrong.');
		}

		if (!tag || !tag.author) {
			return Promise.reject(`That tag doesn't exist.`);
		}

		let canDelete = false;

		if (message.author.id === tag.author.id) {
			canDelete = true;
		}

		if (!canDelete) {
			if (this.isAdmin(message.author) ||
				this.isServerAdmin(message.member, message.channel) ||
				this.isServerMod(message.member, message.channel)) {
					canDelete = true;
				}
		}

		if (!canDelete) {
			return Promise.reject(null);
		}

		try {
			await this.models.Tag.remove({ _id: tag._id });
		} catch (err) {
			return Promise.reject('Something went wrong.');
		}

		return Promise.resolve(`Tag ${_tag} deleted.`);
	}

	public async getTag(message: eris.Message, tag: string, guildConfig: rnet.GuildConfig) {
		const guild = (<eris.GuildChannel>message.channel).guild;
		if (!this.isEnabled(guild, this)) {
			return Promise.reject(null);
		}

		let doc;
		try {
			doc = await this.models.Tag.findOne({ guild: guild.id, tag }).lean().exec();
		} catch (err) {
			return Promise.reject(`Something went wrong.`);
		}

		if (!doc) {
			return Promise.reject(`No tag ${tag} found.`);
		}

		return Promise.resolve(doc.content);
	}

	public async listTags(message: eris.Message, guildId: string, guildConfig: rnet.GuildConfig, query?: string) {
		const guild = (<eris.GuildChannel>message.channel).guild;
		if (!this.isEnabled(guild, this, guildConfig)) {
			return Promise.reject(null);
		}

		guildId = guildId || guild.id;

		let count: number;
		let tags: any[];

		try {
			[count, tags] = await Promise.all([
				this.models.Tag.count({ guild: guildId }),
				this.models.Tag.find({ guild: guildId }).limit(100).lean().exec(),
			]);
		} catch (err) {
			return Promise.reject(`Something went wrong.`);
		}

		if (!tags) {
			return Promise.resolve('There are no tags.');
		}

		if (query != undefined) {
			tags = tags.filter((t: any) => t.tag.toLowerCase().search(query) > -1);
		}

		const embed = {
			color: this.utils.getColor('blue'),
			title: `Tags (${count})`,
			description: null,
			fields: [],
			footer: { text: `Use "${guildConfig.prefix || '?'}tag name" to show a tag` },
		};

		if (tags.length) {
			const messageParts = this.utils.splitMessage(tags.map((t: any) => t.tag).join(', '), 2000);
			let fields;

			embed.description = messageParts[0];

			if (messageParts.length > 1) {
				fields = this.utils.splitMessage(messageParts[1], 1000);

				embed.fields = [];
				for (const field of fields) {
					embed.fields.push({ name: '\u200b', value: field });
				}
			}
		} else {
			return Promise.resolve('There are no tags.');
		}

		// tags = `Tags: ${tags.map(t => t.tag).join(', ')}\n Use \`${guildConfig.prefix || '?'}tag name\` to get a tag`;

		// tags = utils.splitMessage(tags, 1990);
		return Promise.resolve({ embed });
	}

	public get(guild: eris.Guild, tag: string) {
		return this.models.Tag.findOne({ guild: guild.id, tag }).lean().exec();
	}
}
