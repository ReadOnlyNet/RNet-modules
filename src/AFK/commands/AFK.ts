import { Command, CommandData, SubCommand } from '@rnet.cf/rnet-core';
import * as eris from '@rnet.cf/eris';
import {default as AFKModule} from '../index';

export default class AFK extends Command {
	public aliases       : string[] = ['afk'];
	public group         : string   = 'Misc';
	public module        : string   = 'AFK';
	public description   : string   = `Set an AFK status to display when you are mentioned`;
	public expectedArgs  : number   = 0;
	public defaultCommand: string   = 'set';
	public defaultUsage  : string   = 'afk';
	public cooldown      : number   = 30000;

	public commands: SubCommand[] = [
		{ name: 'set', desc: `Set an AFK status shown when you're mentioned, and display in nickname.`,
			usage: 'set [status]', cooldown: 61000 },
		{ name: 'ignore', desc: `Use in a channel to not return from AFK when talking in that channel.`,
			usage: 'ignore [channel]', cooldown: 5000 },
	];

	public usage: string[] = [
		'afk [status]',
		'afk set [status] - same as afk [status]',
		`afk ignore - ignore the channel you're in when you use the command.`,
	];
	public example: string[] = [
		'afk gone for the day',
		'afk ignore #staff',
	];

	private _afk: AFKModule;

	public execute() {
		this._afk = this.rnet.modules.get('AFK');
		return Promise.resolve();
	}

	public set({ message, args, guildConfig }: CommandData): Promise<any> {
		const status = args && args.length ? args.join(' ') : 'AFK';

		if (this._afk.isAFK(message, guildConfig) && (!args || !args.length)) {
			return Promise.resolve();
		}

		return this._afk.setAFK(message, status, guildConfig)
			.then((res: string) => this.sendMessage(message.channel, res))
			.catch(() => null);
	}

	public ignore({ message, args }: CommandData): Promise<any> {
		if (!this.isServerMod(message.member, message.channel)) {
			return;
		}
		const guildConfig = this.rnet.guilds.get((<eris.GuildChannel>message.channel).guild.id);
		return this._afk.ignoreChannel(message, guildConfig)
			.then((res: string) => {
				if (res && res.length) {
					this.success(message.channel, res);
				}
			})
			.catch((err: string) => this.error(message.channel, err));
	}
}
