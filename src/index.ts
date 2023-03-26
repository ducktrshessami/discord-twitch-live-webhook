import {
    executeWebhook,
    relativeTimestamp,
    WebhookOptions
} from "./discord";
import {
    authorize,
    channelUrl,
    getChannels,
    getStreams,
    getUsers,
    isStreamOnlineBody,
    NotificationType,
    RequestHeaders,
    StreamFilterType,
    StreamOnlineCallbackVerificationBody,
    StreamOnlineNotificationBody,
    StreamOnlineRevocationBody,
    StreamOnlineWebhookBody,
    verifyRequest,
    WebhookBody
} from "./twitch";
import { requestHeader } from "./utils";

export interface Env {
    TWITCH_CLIENT_ID: string;
    TWITCH_CLIENT_SECRET: string;
    TWITCH_AGE_WARNING?: string;
    DISCORD_WEBHOOK_ID?: string;
    DISCORD_WEBHOOK_TOKEN?: string;
    DISCORD_WEBHOOK_URL?: string;
    DISCORD_USERNAME?: string;
    DISCORD_AVATAR_URL?: string;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        try {
            const body = await request.blob();
            if (!(await verifyRequest(env.TWITCH_CLIENT_SECRET, request, body))) {
                return new Response(null, { status: 401 });
            }
            const timestamp = resolveTimestamp(request, env);
            const json: WebhookBody = JSON.parse(await body.text());
            if (!isStreamOnlineBody(json)) {
                return new Response(null, { status: 403 });
            }
            switch (request.headers.get(RequestHeaders.MessageType)) {
                case NotificationType.Notification: return handleNotification(
                    env,
                    ctx,
                    <StreamOnlineNotificationBody>json,
                    timestamp
                );
                case NotificationType.WebhookCallbackVerification: return handleChallenge(<StreamOnlineCallbackVerificationBody>json);
                case NotificationType.Revocation: return handleRevocation(env, ctx, json);
            }
        }
        catch (err) {
            console.error(err);
        }
        return new Response(null, { status: 400 });
    },
};

function checkAge(
    env: Env,
    timestamp: number,
    rawTimestamp: string
): void {
    const TWITCH_AGE_WARNING = env.TWITCH_AGE_WARNING ? parseInt(env.TWITCH_AGE_WARNING) : 300000;
    const now = new Date();
    const age = now.getTime() - timestamp;
    if (age > TWITCH_AGE_WARNING) {
        console.warn(`[${now.toISOString()}] Received request with timestamp older than ${TWITCH_AGE_WARNING} ms: '${rawTimestamp}'`);
        // TODO: Age warning
    }
}

async function forwardNotification(
    env: Env,
    body: StreamOnlineNotificationBody,
    timestamp: number
): Promise<void> {
    try {
        const info = await fetchEventSubStreamInfo(env, body);
        await executeWebhook(resolveWebhookEnvs(env), {
            username: env.DISCORD_USERNAME,
            avatar_url: env.DISCORD_AVATAR_URL,
            content: "@everyone",
            embeds: [{
                title: info.title,
                url: channelUrl(info.userLogin),
                thumbnail: { url: info.userAvatarUrl },
                description: `**${info.userName}** ${info.startedAt ? "went live" : "goes live"} ${relativeTimestamp(info.startedAt?.getTime() ?? timestamp + info.delay)}\nPlaying **${info.gameName}**`,
                image: info.thumbnailUrl ? { url: info.thumbnailUrl } : undefined
            }]
        });
    }
    catch (err) {
        console.error(err);
    }
}

async function forwardRevocation(env: Env, body: StreamOnlineRevocationBody): Promise<void> {
    try {
        const { data: [channel] } = await authorize(
            env.TWITCH_CLIENT_ID,
            env.TWITCH_CLIENT_SECRET,
            token => getChannels(
                env.TWITCH_CLIENT_ID,
                token,
                [body.subscription.condition.broadcaster_user_id]
            )
        );
        const status = body.subscription.status.replace("_", " ");
        await executeWebhook(resolveWebhookEnvs(env), {
            username: env.DISCORD_USERNAME,
            avatar_url: env.DISCORD_AVATAR_URL,
            content: `Subscription to channel **${channel.broadcaster_name}** revoked: ${status}`
        });
    }
    catch (err) {
        console.error(err);
    }
}

function resolveTimestamp(request: Request, env: Env): number {
    const rawTimestamp = requestHeader(request, RequestHeaders.MessageTimestamp);
    if (rawTimestamp) {
        const parsedTimestamp = new Date(rawTimestamp);
        const timestamp = parsedTimestamp.getTime();
        checkAge(env, timestamp, rawTimestamp);
        return timestamp;
    }
    else {
        return Date.now();
    }
}

function handleNotification(
    env: Env,
    ctx: ExecutionContext,
    body: StreamOnlineNotificationBody,
    timestamp: number
): Response {
    ctx.waitUntil(
        forwardNotification(
            env,
            body,
            timestamp
        )
    );
    return new Response(null, { status: 204 });
}

function handleChallenge(body: StreamOnlineCallbackVerificationBody): Response {
    return new Response(body.challenge, { status: 200 });
}

function handleRevocation(env: Env, ctx: ExecutionContext, body: StreamOnlineRevocationBody): Response {
    ctx.waitUntil(forwardRevocation(env, body));
    return new Response(null, { status: 204 });
}

async function fetchEventSubStreamInfo(env: Env, body: StreamOnlineWebhookBody): Promise<StreamInfo> {
    return await authorize(
        env.TWITCH_CLIENT_ID,
        env.TWITCH_CLIENT_SECRET,
        async (token): Promise<StreamInfo> => {
            const [
                { data: [stream] },
                { data: [channel] },
                { data: [user] }
            ] = await Promise.all([
                getStreams(
                    env.TWITCH_CLIENT_ID,
                    token,
                    {
                        type: StreamFilterType.Live,
                        userIds: [body.subscription.condition.broadcaster_user_id]
                    }
                ),
                getChannels(
                    env.TWITCH_CLIENT_ID,
                    token,
                    [body.subscription.condition.broadcaster_user_id]
                ),
                getUsers(
                    env.TWITCH_CLIENT_ID,
                    token,
                    { ids: [body.subscription.condition.broadcaster_user_id] }
                )
            ]);
            return {
                userId: stream?.user_id ?? channel.broadcaster_id,
                userLogin: stream?.user_login ?? channel.broadcaster_login,
                userName: stream?.user_name ?? channel.broadcaster_name,
                userAvatarUrl: user.profile_image_url,
                gameId: stream?.game_id ?? channel.game_id,
                gameName: stream?.game_name ?? channel.game_name,
                title: stream?.title ?? channel.title,
                delay: channel.delay,
                startedAt: stream?.started_at ? new Date(stream.started_at) : undefined,
                language: stream?.language ?? channel.broadcaster_language,
                thumbnailUrl: stream?.thumbnail_url
            };
        }
    );
}

function resolveWebhookEnvs(env: Env): WebhookOptions {
    return {
        id: env.DISCORD_WEBHOOK_ID,
        token: env.DISCORD_WEBHOOK_TOKEN,
        url: env.DISCORD_WEBHOOK_URL
    };
}

type StreamInfo = {
    userId: string;
    userLogin: string;
    userName: string;
    userAvatarUrl: string;
    gameId: string;
    gameName: string;
    title: string;
    delay: number;
    startedAt?: Date;
    language: string;
    thumbnailUrl?: string;
};
