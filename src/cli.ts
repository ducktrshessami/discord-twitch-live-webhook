import inquirer, {
    DistinctChoice,
    DistinctQuestion
} from "inquirer";
import {
    ListedEventSubscription,
    StreamOnlineSubscription,
    SubscriptionType,
    TransportMethod
} from "./twitch.js";

function validate(input: string): boolean {
    return !!input.trim();
}

const AuthorizationQuestions: Array<DistinctQuestion<AuthorizationAnswers>> = [
    {
        type: "input",
        name: "clientId",
        prefix: "",
        message: "Client ID:",
        validate
    },
    {
        type: "input",
        name: "clientSecret",
        prefix: "",
        message: "Client Secret:",
        validate
    }
];
const ConfirmationQuestion: DistinctQuestion<ConfirmationAnswers> = {
    type: "confirm",
    name: "confirm",
    prefix: "",
    message: "Confirm?"
};

export const SubscribeQuestions: Array<DistinctQuestion<SubscribeAnswers>> = (<Array<DistinctQuestion<any>>>AuthorizationQuestions).concat(
    {
        type: "input",
        name: "broadcasterName",
        prefix: "",
        message: "Channel Name:",
        validate
    },
    {
        type: "input",
        name: "callback",
        prefix: "",
        message: "Callback Endpoint:",
        validate
    },
    ConfirmationQuestion
);

export const PreUnsubscribeQuestions: Array<DistinctQuestion<PreUnsubscribeAnswers>> = (<Array<DistinctQuestion<any>>>AuthorizationQuestions).concat(ConfirmationQuestion);

export function createUnsubscribeQuestions(subscriptions: Array<ListedEventSubscription>): Array<DistinctQuestion<UnsubscribeAnswers>> {
    return [
        {
            type: "list",
            name: "subscription",
            prefix: "",
            message: "Subscription (by user ID):",
            choices: subscriptions
                .reduce(
                    (choices, subscription) => {
                        if (subscription.type === SubscriptionType.StreamOnline && subscription.transport.method === TransportMethod.Webhook) {
                            choices.push({
                                name: `[Status: ${subscription.status}] ${(<StreamOnlineSubscription>subscription).condition.broadcaster_user_id} (Callback: ${subscription.transport.callback})`,
                                value: subscription
                            });
                        }
                        return choices;
                    },
                    new Array<DistinctChoice<UnsubscribeAnswers>>()
                )
                .concat(new inquirer.Separator(" "))
        },
        ConfirmationQuestion
    ];
}

type AuthorizationAnswers = {
    clientId: string;
    clientSecret: string;
};
type ConfirmationAnswers = { confirm: boolean };
type GenericAuthorizationAnswers = AuthorizationAnswers & ConfirmationAnswers;

type SubscribeAnswers = AuthorizationAnswers & ConfirmationAnswers & {
    broadcasterName: string;
    callback: string;
};

type PreUnsubscribeAnswers = GenericAuthorizationAnswers;
type UnsubscribeAnswers = ConfirmationAnswers & { subscription: ListedEventSubscription };
