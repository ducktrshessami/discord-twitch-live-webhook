export enum MessageFlags {
    Crossposted = 1,
    IsCrosspost = 2,
    SuppressEmbeds = 4,
    SourceMessageDeleted = 8,
    Urgent = 16,
    HasThread = 32,
    Ephemeral = 64,
    Loading = 128,
    FailedToMentionSomeRolesInThread = 256,
    SuppressNotifications = 4096
}

export enum EmbedType {
    Rich = "rich",
    Image = "image",
    Video = "video",
    Gifv = "gifv",
    Article = "article",
    Link = "link"
}

export enum AllowedMentionTypes {
    Roles = "roles",
    Users = "users",
    Everyone = "everyone"
}

export type EmbedFooter = {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
};
type EmbedVisual = {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
};
export type EmbedImage = EmbedVisual;
export type EmbedThumbnail = EmbedVisual;
export type EmbedVideo = EmbedVisual;
export type EmbedProvider = {
    name?: string;
    url?: string;
};
export type EmbedAuthor = {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
};
export type EmbedField = {
    name: string;
    value: string;
    inline?: boolean;
};
export type Embed = {
    title?: string;
    type?: `${EmbedType.Rich}`;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number;
    footer?: EmbedFooter;
};

export type AllowedMentions = {
    parse?: Array<`${AllowedMentionTypes}`>;
    roles?: Array<string>;
    users?: Array<string>;
    replied_user?: boolean;
};

export type WebhookMessageWithoutAttachmentsBody = {
    content?: string;
    username?: string;
    avatar_url?: string;
    tts?: boolean;
    embeds?: Array<Embed>;
    allowed_mentions?: AllowedMentions;
    flags?: 0 | MessageFlags.SuppressEmbeds;
    thread_name?: string;
};
