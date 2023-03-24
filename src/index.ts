import {
    authorize,
    getChannels,
    getStreams,
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
    TWITCH_SECRET: string;
    TWITCH_AGE_WARNING?: string;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        try {
            const body = await request.blob();
            if (!(await verifyRequest(env.TWITCH_SECRET, request, body))) {
                return new Response(null, { status: 401 });
            }
            checkAge(request, env);
            const json: WebhookBody = JSON.parse(await body.text());
            if (!isStreamOnlineBody(json)) {
                return new Response(null, { status: 403 });
            }
            switch (request.headers.get(RequestHeaders.MessageType)) {
                case NotificationType.Notification: return handleNotification(env, ctx, <StreamOnlineNotificationBody>json);
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

function checkAge(request: Request, env: Env): void {
    const TWITCH_AGE_WARNING = env.TWITCH_AGE_WARNING ? parseInt(env.TWITCH_AGE_WARNING) : 300000;
    const now = new Date();
    const rawTimestamp = requestHeader(request, RequestHeaders.MessageTimestamp);
    const timestamp = new Date(rawTimestamp);
    const age = now.getTime() - timestamp.getTime();
    if (age > TWITCH_AGE_WARNING) {
        console.warn(`[${now.toISOString()}] Received request with timestamp older than ${TWITCH_AGE_WARNING} ms: '${rawTimestamp}'`);
        // TODO: Age warning
    }
}

function handleNotification(env: Env, ctx: ExecutionContext, body: StreamOnlineNotificationBody): Response {
    ctx.waitUntil(forwardNotification(env, body));
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
        env.TWITCH_SECRET,
        async (token): Promise<StreamInfo> => {
            const { data: [stream] } = await getStreams(
                env.TWITCH_CLIENT_ID,
                token,
                {
                    type: StreamFilterType.Live,
                    userIds: [body.subscription.condition.broadcaster_user_id]
                }
            );
            if (stream) {
                return {
                    userId: stream.user_id,
                    userLogin: stream.user_login,
                    userName: stream.user_name,
                    gameId: stream.game_id,
                    gameName: stream.game_name,
                    title: stream.title,
                    startedAt: new Date(stream.started_at),
                    language: stream.language,
                    thumbnailUrl: stream.thumbnail_url
                };
            }
            const { data: [channel] } = await getChannels(
                env.TWITCH_CLIENT_ID,
                token,
                [body.subscription.condition.broadcaster_user_id]
            );
            return {
                userId: channel.broadcaster_id,
                userLogin: channel.broadcaster_login,
                userName: channel.broadcaster_name,
                gameId: channel.game_id,
                gameName: channel.game_name,
                title: channel.title,
                language: channel.broadcaster_language
            };
        }
    );
}

async function forwardNotification(env: Env, body: StreamOnlineNotificationBody): Promise<void> {
    try {
        const info = await fetchEventSubStreamInfo(env, body);
    }
    catch (err) {
        console.error(err);
    }
}

async function forwardRevocation(env: Env, body: StreamOnlineRevocationBody): Promise<void> {
    try {
        const info = await fetchEventSubStreamInfo(env, body);
    }
    catch (err) {
        console.error(err);
    }
}

type StreamInfo = {
    userId: string;
    userLogin: string;
    userName: string;
    gameId: string;
    gameName: string;
    title: string;
    startedAt?: Date;
    language: string;
    thumbnailUrl?: string;
};
