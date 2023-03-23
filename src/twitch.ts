import { Env } from "./index.js";
import { FetchError } from "./error.js";
import {
    hexBuffer,
    requestHeader,
    stringBuffer
} from "./utils.js";

export const API_VERSION = "1";
const HMAC_PREFIX = "sha256=";
const OAUTH_GRANT_TYPE = "client_credentials";

export const OAUTH_BASE_ENDPOINT = "https://id.twitch.tv/oauth2";
const OAUTH_TOKEN_ENDPOINT = OAUTH_BASE_ENDPOINT + "/token";
const OAUTH_REVOKE_ENDPOINT = OAUTH_BASE_ENDPOINT + "/revoke";

export const API_BASE_ENDPOINT = "https://api.twitch.tv/helix";
const GET_USERS_ENDPOINT = API_BASE_ENDPOINT + "/users";
const SUBSCRIPTION_ENDPOINT = API_BASE_ENDPOINT + "/eventsub/subscriptions";

export enum RequestHeaders {
    MessageId = "twitch-eventsub-message-id",
    MessageRetry = "twitch-eventsub-message-retry",
    MessageType = "twitch-eventsub-message-type",
    MessageSignature = "twitch-eventsub-message-signature",
    MessageTimestamp = "twitch-eventsub-message-timestamp",
    SubscriptionType = "twitch-eventsub-subscription-type",
    SubscriptionVersion = "twitch-eventsub-subscription-version"
}

export enum NotificationType {
    Notification = "notification",
    WebhookCallbackVerification = "webhook_callback_verification",
    Revocation = "revocation"
}

export enum SubscriptionType {
    ChannelUpdate = "channel.update",
    ChannelFollow = "channel.follow",
    ChannelSubscribe = "channel.subscribe",
    ChannelSubscriptionEnd = "channel.subscription.end",
    ChannelSubscriptionGift = "channel.subscription.gift",
    ChannelSubscriptionMessage = "channel.subscription.message",
    ChannelCheer = "channel.cheer",
    ChannelRaid = "channel.raid",
    ChannelBan = "channel.ban",
    ChannelUnban = "channel.unban",
    ChannelModeratorAdd = "channel.moderator.add",
    ChannelModeratorRemove = "channel.moderator.remove",
    ChannelPointsCustomRewardAdd = "channel.channel_points_custom_reward.add",
    ChannelPointsCustomRewardUpdate = "channel.channel_points_custom_reward.update",
    ChannelPointsCustomRewardRemove = "channel.channel_points_custom_reward.remove",
    ChannelPointsCustomRewardRedemptionAdd = "channel.channel_points_custom_reward_redemption.add",
    ChannelPointsCustomRewardRedemptionUpdate = "channel.channel_points_custom_reward_redemption.update",
    ChannelPollBegin = "channel.poll.begin",
    ChannelPollProgress = "channel.poll.progress",
    ChannelPollEnd = "channel.poll.end",
    ChannelPredictionBegin = "channel.prediction.begin",
    ChannelPredictionProgress = "channel.prediction.progress",
    ChannelPredictionLock = "channel.prediction.lock",
    ChannelPredictionEnd = "channel.prediction.end",
    CharityDonation = "channel.charity_campaign.donate",
    CharityCampaignStart = "channel.charity_campaign.start",
    CharityCampaignProgress = "channel.charity_campaign.progress",
    CharityCampaignStop = "channel.charity_campaign.stop",
    DropEntitlementGrant = "drop.entitlement.grant",
    ExtensionBitsTransactionCreate = "extension.bits_transaction.create",
    GoalBegin = "channel.goal.begin",
    GoalProgress = "channel.goal.progress",
    GoalEnd = "channel.goal.end",
    HypeTrainBegin = "channel.hype_train.begin",
    HypeTrainProgress = "channel.hype_train.progress",
    HypeTrainEnd = "channel.hype_train.end",
    ShieldModeBegin = "channel.shield_mode.begin",
    ShieldModeEnd = "channel.shield_mode.end",
    ShoutoutCreate = "channel.shoutout.create",
    ShoutoutReceived = "channel.shoutout.receive",
    StreamOnline = "stream.online",
    StreamOffline = "stream.offline",
    UserAuthorizationGrant = "user.authorization.grant",
    UserAuthorizationRevoke = "user.authorization.revoke",
    UserUpdate = "user.update"
}

export enum SubscriptionStatus {
    Enabled = "enabled",
    WebhookCallbackVerificationPending = "webhook_callback_verification_pending",
    WebhookCallbackVerificationFailed = "webhook_callback_verification_failed",
    NotificationFailuresExceeded = "notification_failures_exceeded",
    AuthorizationRevoked = "authorization_revoked",
    ModeratorRemoved = "moderator_removed",
    UserRemoved = "user_removed",
    VersionRemoved = "version_removed",
    WebsocketDisconnected = "websocket_disconnected",
    WebsocketFailedPingPong = "websocket_failed_ping_pong",
    WebsocketReceivedInboundTraffic = "websocket_received_inbound_traffic",
    WebsocketConnectionUnused = "websocket_connection_unused",
    WebsocketInternalError = "websocket_internal_error",
    WebsocketNetworkTimeout = "websocket_network_timeout",
    WebsocketNetworkError = "websocket_network_error"
}

export enum StreamType {
    Live = "live",
    Playlist = "playlist",
    WatchParty = "watch_party",
    Premiere = "premiere",
    Rerun = "rerun"
}

export enum TransportMethod {
    Webhook = "webhook",
    Websocket = "websocket"
}

export enum UserType {
    Admin = "admin",
    GlobalMod = "global_mod",
    Staff = "staff",
    Normal = ""
}

export enum BroadcasterType {
    Affiliate = "affiliate",
    Partner = "partner",
    Normal = ""
}

async function getKey(env: Env): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        "raw",
        stringBuffer(env.TWITCH_SECRET),
        {
            name: "HMAC",
            hash: "SHA-256"
        },
        false,
        ["verify"]
    );
}

async function getHmacMessage(request: Request, body: Blob): Promise<ArrayBuffer> {
    return await new Blob([
        requestHeader(request, RequestHeaders.MessageId),
        requestHeader(request, RequestHeaders.MessageTimestamp),
        body
    ])
        .arrayBuffer();
}

export async function verifyRequest(request: Request, body: Blob, env: Env): Promise<boolean> {
    const signature = requestHeader(request, RequestHeaders.MessageSignature);
    const [key, message] = await Promise.all([
        getKey(env),
        getHmacMessage(request, body)
    ]);
    return await crypto.subtle.verify(
        "HMAC",
        key,
        hexBuffer(signature.startsWith(HMAC_PREFIX) ? signature.slice(HMAC_PREFIX.length) : signature),
        message
    );
}

export function isStreamOnlineBody(body: WebhookBody): body is StreamOnlineWebhookBody {
    return body.subscription.type === SubscriptionType.StreamOnline;
}

async function oauthRequest(url: string, body: any): Promise<Response> {
    const query = new URLSearchParams(body);
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: query.toString()
    });
    if (res.status === 200) {
        return res;
    }
    else {
        throw new FetchError(res);
    }
}

export async function getClientCredentials(clientId: string, clientSecret: string): Promise<ClientCredentialGrantResponse> {
    const res = await oauthRequest(OAUTH_TOKEN_ENDPOINT, {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: OAUTH_GRANT_TYPE
    } satisfies ClientCredentialGrantQueryPairs);
    return await res.json();
}

export async function revokeClientCredentials(clientId: string, token: string): Promise<void> {
    await oauthRequest(OAUTH_REVOKE_ENDPOINT, {
        client_id: clientId,
        token
    } satisfies ClientCredentialRevokeQueryPairs);
}

export async function authorize(
    clientId: string,
    clientSecret: string,
    fn: (accessToken: string) => void | Promise<void>
): Promise<void> {
    let error: any;
    const { access_token } = await getClientCredentials(clientId, clientSecret);
    try {
        await fn(access_token);
    }
    catch (err) {
        error = err;
    }
    finally {
        await revokeClientCredentials(clientId, access_token);
        if (error) {
            throw error;
        }
    }
}

async function authorizedRequest(
    clientId: string,
    accessToken: string,
    url: string,
    method: string,
    options: AuthorizedSubscriptionRequestOptions
): Promise<Response> {
    const target = new URL(url);
    const headers: HeadersInit = {
        "Client-Id": clientId,
        Authorization: `Bearer ${accessToken}`
    };
    let body: BodyInit | null = null;
    if (options.body) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }
    if (options.query) {
        target.search = options.query.toString();
    }
    return await fetch(target, {
        method,
        headers,
        body
    });
}

export async function getUsers(
    clientId: string,
    accessToken: string,
    options: GetUsersOptions
): Promise<GetUsersResponse> {
    const query = new URLSearchParams();
    options.ids?.forEach(id => query.append("id", id));
    options.logins?.forEach(login => query.append("login", login));
    const res = await authorizedRequest(
        clientId,
        accessToken,
        GET_USERS_ENDPOINT,
        "GET",
        { query }
    );
    if (res.status === 200) {
        return await res.json();
    }
    else {
        throw new FetchError(res);
    }
}

export async function subscribe(
    clientId: string,
    accessToken: string,
    broadcasterId: string,
    callbackEndpoint: string,
    secret: string
): Promise<void> {
    const res = await authorizedRequest(
        clientId,
        accessToken,
        SUBSCRIPTION_ENDPOINT,
        "POST",
        {
            body: {
                type: SubscriptionType.StreamOnline,
                version: API_VERSION,
                condition: { broadcaster_user_id: broadcasterId },
                transport: {
                    method: TransportMethod.Webhook,
                    callback: callbackEndpoint,
                    secret: secret
                }
            } satisfies CreateStreamOnlineSubscriptionBody
        }
    );
    if (res.status !== 202) {
        throw new FetchError(res);
    }
}

export async function getSubscriptions(
    clientId: string,
    accessToken: string,
    options: GetSubscriptionsOptions = {}
): Promise<GetEventSubsResponse> {
    const res = await authorizedRequest(
        clientId,
        accessToken,
        SUBSCRIPTION_ENDPOINT,
        "GET",
        { query: new URLSearchParams(options) }
    );
    if (res.status === 200) {
        return await res.json();
    }
    else {
        throw new FetchError(res);
    }
}

export async function deleteSubscription(
    clientId: string,
    accessToken: string,
    subscriptionId: string
): Promise<void> {
    const res = await authorizedRequest(
        clientId,
        accessToken,
        SUBSCRIPTION_ENDPOINT,
        "DELETE",
        { query: new URLSearchParams({ id: subscriptionId }) }
    );
    if (res.status !== 204) {
        throw new FetchError(res);
    }
}

export type BroadcasterTargettedCondition = { broadcaster_user_id: string };
export type ChannelFollowCondition = BroadcasterTargettedCondition & { moderator_user_id: string };
export type ChannelRaidCondition = {
    from_broadcaster_user_id?: string;
    to_broadcaster_user_id?: string;
};
export type ChannelPointsCustomSpecificRewardCondition = BroadcasterTargettedCondition & { reward_id?: string };
export type DropEntitlementGrantCondition = {
    organization_id: string;
    category_id?: string;
    campaign_id?: string;
};
export type ExtensionBitsTransactionCreateCondition = { extension_client_id: string };
export type UserAuthorizationCondition = { client_id: string };
export type UserUpdateCondition = { user_id: string };
export type Condition =
    BroadcasterTargettedCondition |
    ChannelFollowCondition |
    ChannelRaidCondition |
    ChannelPointsCustomSpecificRewardCondition |
    DropEntitlementGrantCondition |
    ExtensionBitsTransactionCreateCondition |
    UserAuthorizationCondition |
    UserUpdateCondition;

export interface BaseSubscription {
    id: string;
    type: `${SubscriptionType}`;
    version: string;
    status: `${SubscriptionStatus}`;
    cost: number;
    condition: object;
    created_at: string;
}
export interface ChannelUpdateSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelUpdate}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelFollowSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelFollow}`;
    condition: ChannelFollowCondition;
}
export interface ChannelSubscribeSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelSubscribe}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelSubscriptionEndSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelSubscriptionEnd}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelSubscriptionGiftSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelSubscriptionGift}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelSubscriptionMessageSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelSubscriptionMessage}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelCheerSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelCheer}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelRaidSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelRaid}`;
    condition: ChannelRaidCondition;
}
export interface ChannelBanSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelBan}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelUnbanSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelUnban}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelModeratorAddSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelModeratorAdd}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelModeratorRemoveSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelModeratorRemove}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPointsCustomRewardAddSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPointsCustomRewardAdd}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPointsCustomRewardUpdateSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPointsCustomRewardUpdate}`;
    condition: ChannelPointsCustomSpecificRewardCondition;
}
export interface ChannelPointsCustomRewardRemoveSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPointsCustomRewardRemove}`;
    condition: ChannelPointsCustomSpecificRewardCondition;
}
export interface ChannelPointsCustomRewardRedemptionAddSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPointsCustomRewardRedemptionAdd}`;
    condition: ChannelPointsCustomSpecificRewardCondition;
}
export interface ChannelPointsCustomRewardRedemptionUpdateSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPointsCustomRewardRedemptionUpdate}`;
    condition: ChannelPointsCustomSpecificRewardCondition;
}
export interface ChannelPollBeginSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPollBegin}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPollProgressSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPollProgress}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPollEndSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPollEnd}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPredictionBeginSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPredictionBegin}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPredictionProgressSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPredictionProgress}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPredictionLockSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPredictionLock}`;
    condition: BroadcasterTargettedCondition;
}
export interface ChannelPredictionEndSubscription extends BaseSubscription {
    type: `${SubscriptionType.ChannelPredictionEnd}`;
    condition: BroadcasterTargettedCondition;
}
export interface CharityDonationSubscription extends BaseSubscription {
    type: `${SubscriptionType.CharityDonation}`;
    condition: BroadcasterTargettedCondition;
}
export interface CharityCampaignStartSubscription extends BaseSubscription {
    type: `${SubscriptionType.CharityCampaignStart}`;
    condition: BroadcasterTargettedCondition;
}
export interface CharityCampaignProgressSubscription extends BaseSubscription {
    type: `${SubscriptionType.CharityCampaignProgress}`;
    condition: BroadcasterTargettedCondition;
}
export interface CharityCampaignStopSubscription extends BaseSubscription {
    type: `${SubscriptionType.CharityCampaignStop}`;
    condition: BroadcasterTargettedCondition;
}
export interface DropEntitlementGrantSubscription extends BaseSubscription {
    type: `${SubscriptionType.DropEntitlementGrant}`;
    condition: DropEntitlementGrantCondition;
}
export interface ExtensionBitsTransactionCreateSubscription extends BaseSubscription {
    type: `${SubscriptionType.ExtensionBitsTransactionCreate}`;
    condition: ExtensionBitsTransactionCreateCondition;
}
export interface GoalBeginSubscription extends BaseSubscription {
    type: `${SubscriptionType.GoalBegin}`;
    condition: BroadcasterTargettedCondition;
}
export interface GoalProgressSubscription extends BaseSubscription {
    type: `${SubscriptionType.GoalProgress}`;
    condition: BroadcasterTargettedCondition;
}
export interface GoalEndSubscription extends BaseSubscription {
    type: `${SubscriptionType.GoalEnd}`;
    condition: BroadcasterTargettedCondition;
}
export interface HypeTrainBeginSubscription extends BaseSubscription {
    type: `${SubscriptionType.HypeTrainBegin}`;
    condition: BroadcasterTargettedCondition;
}
export interface HypeTrainProgressSubscription extends BaseSubscription {
    type: `${SubscriptionType.HypeTrainProgress}`;
    condition: BroadcasterTargettedCondition;
}
export interface HypeTrainEndSubscription extends BaseSubscription {
    type: `${SubscriptionType.HypeTrainEnd}`;
    condition: BroadcasterTargettedCondition;
}
export interface ShieldModeBeginSubscription extends BaseSubscription {
    type: `${SubscriptionType.ShieldModeBegin}`;
    condition: BroadcasterTargettedCondition;
}
export interface ShieldModeEndSubscription extends BaseSubscription {
    type: `${SubscriptionType.ShieldModeEnd}`;
    condition: BroadcasterTargettedCondition;
}
export interface ShoutoutCreateSubscription extends BaseSubscription {
    type: `${SubscriptionType.ShoutoutCreate}`;
    condition: BroadcasterTargettedCondition;
}
export interface ShoutoutReceivedSubscription extends BaseSubscription {
    type: `${SubscriptionType.ShoutoutReceived}`;
    condition: BroadcasterTargettedCondition;
}
export interface StreamOnlineSubscription extends BaseSubscription {
    type: `${SubscriptionType.StreamOnline}`;
    condition: BroadcasterTargettedCondition;
}
export interface StreamOfflineSubscription extends BaseSubscription {
    type: `${SubscriptionType.StreamOffline}`;
    condition: BroadcasterTargettedCondition;
}
export interface UserAuthorizationGrantSubscription extends BaseSubscription {
    type: `${SubscriptionType.UserAuthorizationGrant}`;
    condition: UserAuthorizationCondition;
}
export interface UserAuthorizationRevokeSubscription extends BaseSubscription {
    type: `${SubscriptionType.UserAuthorizationRevoke}`;
    condition: UserAuthorizationCondition;
}
export interface UserUpdateSubscription extends BaseSubscription {
    type: `${SubscriptionType.UserUpdate}`;
    condition: UserUpdateCondition;
}
export type InvalidSubscription =
    ChannelUpdateSubscription |
    ChannelFollowSubscription |
    ChannelSubscribeSubscription |
    ChannelSubscriptionEndSubscription |
    ChannelSubscriptionGiftSubscription |
    ChannelSubscriptionMessageSubscription |
    ChannelCheerSubscription |
    ChannelRaidSubscription |
    ChannelBanSubscription |
    ChannelUnbanSubscription |
    ChannelModeratorAddSubscription |
    ChannelModeratorRemoveSubscription |
    ChannelPointsCustomRewardAddSubscription |
    ChannelPointsCustomRewardUpdateSubscription |
    ChannelPointsCustomRewardRemoveSubscription |
    ChannelPointsCustomRewardRedemptionAddSubscription |
    ChannelPointsCustomRewardRedemptionUpdateSubscription |
    ChannelPollBeginSubscription |
    ChannelPollProgressSubscription |
    ChannelPollEndSubscription |
    ChannelPredictionBeginSubscription |
    ChannelPredictionProgressSubscription |
    ChannelPredictionLockSubscription |
    ChannelPredictionEndSubscription |
    CharityDonationSubscription |
    CharityCampaignStartSubscription |
    CharityCampaignProgressSubscription |
    CharityCampaignStopSubscription |
    DropEntitlementGrantSubscription |
    ExtensionBitsTransactionCreateSubscription |
    GoalBeginSubscription |
    GoalProgressSubscription |
    GoalEndSubscription |
    HypeTrainBeginSubscription |
    HypeTrainProgressSubscription |
    HypeTrainEndSubscription |
    ShieldModeBeginSubscription |
    ShieldModeEndSubscription |
    ShoutoutCreateSubscription |
    ShoutoutReceivedSubscription |
    StreamOfflineSubscription |
    UserAuthorizationGrantSubscription |
    UserAuthorizationRevokeSubscription |
    UserUpdateSubscription;
export type Subscription = InvalidSubscription | StreamOnlineSubscription;

export type StreamOnlineEvent = {
    id: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    type: `${StreamType}`;
    started_at: string;
};

export interface BaseWebhookBody {
    subscription: Subscription;
}
export interface InvalidSubscriptionWebhookBody extends BaseWebhookBody {
    subscription: InvalidSubscription;
}
export interface StreamOnlineWebhookBody extends BaseWebhookBody {
    subscription: StreamOnlineSubscription;
}
export interface StreamOnlineNotificationBody extends StreamOnlineWebhookBody {
    event: StreamOnlineEvent;
}
export interface StreamOnlineCallbackVerificationBody extends StreamOnlineWebhookBody {
    challenge: string;
}
export type StreamOnlineRevocationBody = StreamOnlineWebhookBody;
export type WebhookBody =
    InvalidSubscriptionWebhookBody |
    StreamOnlineNotificationBody |
    StreamOnlineCallbackVerificationBody |
    StreamOnlineRevocationBody;

interface BaseSubscriptionTransport {
    method: `${TransportMethod}`;
    callback?: string;
    secret?: string;
    session_id?: string;
}
interface CreateWebhookSubscriptionTransportOptions extends BaseSubscriptionTransport {
    method: `${TransportMethod.Webhook}`;
    callback: string;
    secret: string;
    session_id?: never;
}
interface CreatedSubscriptionTransport extends BaseSubscriptionTransport {
    secret?: never;
    connected_at?: string;
}
interface ListedSubscriptionTransport extends CreatedSubscriptionTransport {
    disconnected_at?: string;
}
interface BaseEventSubscription {
    id: string;
    status: `${SubscriptionStatus}`;
    type: `${SubscriptionType}`;
    version: typeof API_VERSION;
    condition: Condition;
    created_at: string;
    transport: CreatedSubscriptionTransport;
    cost: number;
}
interface ListedEventSubscription extends BaseEventSubscription {
    transport: ListedSubscriptionTransport;
}
interface BaseEventSubResponse {
    data: Array<BaseEventSubscription>;
    total: number;
    total_cost: number;
    max_total_cost: number;
}
type Cursor = string;
type GetEventSubPagination = { cursor?: Cursor };
export type CreateEventSubResponse = BaseEventSubResponse;
export interface GetEventSubsResponse extends BaseEventSubResponse {
    data: Array<ListedEventSubscription>;
    pagination: GetEventSubPagination;
}

type AuthorizedSubscriptionRequestOptions = {
    body?: any,
    query?: string | URLSearchParams
};

type CreateStreamOnlineSubscriptionBody = {
    type: `${SubscriptionType.StreamOnline}`;
    version: typeof API_VERSION;
    condition: StreamOnlineSubscription["condition"];
    transport: CreateWebhookSubscriptionTransportOptions;
};

export type GetSubscriptionsOptions = {
    status?: `${SubscriptionStatus}`;
    type?: `${SubscriptionType}`;
    user_id?: string;
    after?: Cursor;
};

type ClientCredentialGrantQueryPairs = {
    client_id: string;
    client_secret: string;
    grant_type: typeof OAUTH_GRANT_TYPE;
};

type ClientCredentialGrantResponse = {
    access_token: string;
    expires_in: number;
    token_type: string;
};

type ClientCredentialRevokeQueryPairs = {
    client_id: string;
    token: string;
};

type GetUsersOptions = {
    ids?: Array<string>;
    logins?: Array<string>;
};

type User = {
    id: string;
    login: string;
    display_name: string;
    type: `${UserType}`;
    broadcaster_type: `${BroadcasterType}`;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    email?: string;
    created_at: string;
};

type GetUsersResponse = { data: Array<User> };
