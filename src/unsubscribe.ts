import inquirer from "inquirer";
import { createUnsubscribeQuestions, PreUnsubscribeQuestions } from "./cli.js";
import {
    authorize,
    deleteSubscription,
    GetEventSubsResponse,
    getSubscriptions,
    ListedEventSubscription,
    StreamOnlineSubscription
} from "./twitch.js";

const authInput = await inquirer.prompt(PreUnsubscribeQuestions);
if (!authInput.confirm) {
    console.log("Cancelled");
    process.exit();
}

await authorize(authInput.clientId, authInput.clientSecret, async token => {
    let page: GetEventSubsResponse | undefined;
    const subscriptions: Array<ListedEventSubscription> = [];
    do {
        page = await getSubscriptions(
            authInput.clientId,
            token,
            page?.pagination.cursor ? { after: page.pagination.cursor } : undefined
        );
        subscriptions.push(...page.data);
    }
    while (page.pagination.cursor);
    if (!subscriptions.length) {
        console.log("No subscriptions found");
        return;
    }

    const unsubInput = await inquirer.prompt(createUnsubscribeQuestions(subscriptions));
    if (!unsubInput.confirm) {
        console.log("Cancelled");
        return;
    }

    await deleteSubscription(
        authInput.clientId,
        token,
        unsubInput.subscription.id
    );
    console.log(`Deleted subscription "${unsubInput.subscription.id}" for user "${(<StreamOnlineSubscription>unsubInput.subscription).condition.broadcaster_user_id}"`);
});
