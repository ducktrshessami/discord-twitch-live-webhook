import { FetchError, WebhookError } from "./error";

export const API_VERSION = "10";

export const API_BASE_ENDPOINT = `https://discord.com/api/v${API_VERSION}`;

const WebhookUrlPattern = /https?:\/\/(?:ptb\.|canary\.)?discord\.com\/api(?:\/v\d{1,2})?\/webhooks\/(?<id>\d{17,19})\/(?<token>[\w-]{68})/i;

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

function resolveWebhookOptions({
    url,
    ...data
}: WebhookOptions): WebhookData | null {
    if (data.id && data.token) {
        return <WebhookData>data;
    }
    const match = WebhookUrlPattern.exec(url ?? "");
    return match ? {
        id: match.groups!.id,
        token: match.groups!.token
    } : null;
}

function webhookUrl(webhook: WebhookData): string {
    return API_BASE_ENDPOINT + `/webhooks/${webhook.id}/${webhook.token}`;
}

export async function executeWebhook(webhookOptions: WebhookOptions, message: WebhookMessageWithoutAttachmentsBody): Promise<void> {
    const webhook = resolveWebhookOptions(webhookOptions);
    if (!webhook) {
        throw new WebhookError("Failed to resolve webhook ID and token");
    }
    const url = webhookUrl(webhook);
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    });
    if (res.status !== 204) {
        throw new FetchError(res);
    }
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
    image?: EmbedImage;
    thumbnail?: EmbedThumbnail;
    video?: EmbedVideo;
    provider?: EmbedProvider;
    author?: EmbedAuthor;
    fields?: Array<EmbedField>;
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

export type WebhookOptions = {
    id?: string;
    token?: string;
    url?: string;
};

type WebhookData = {
    id: string;
    token: string;
};
