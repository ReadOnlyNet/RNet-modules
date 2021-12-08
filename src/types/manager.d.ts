import { CommandData } from '@rnet.cf/rnet-core';

interface AnnounceArgs extends CommandData {
	mention: string;
}