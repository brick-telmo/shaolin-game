CREATE TABLE `online_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`p0` text NOT NULL,
	`p1` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `online_match_age` ON `online_matches` (`updated`);--> statement-breakpoint
CREATE TABLE `online_players` (
	`id` text PRIMARY KEY NOT NULL,
	`client` text NOT NULL,
	`form` text NOT NULL,
	`status` text NOT NULL,
	`match_id` text,
	`protocol` text NOT NULL,
	`joined` integer NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `online_queue` ON `online_players` (`status`,`protocol`,`joined`);