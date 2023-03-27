import inquirer from "inquirer";
import {
    authorize,
    getUsers,
    subscribe
} from "twitch-eventsub-utils";
import { SubscribeQuestions } from "./cli.js";

const input = await inquirer.prompt(SubscribeQuestions);
if (!input.confirm) {
    console.log("Cancelled");
    process.exit();
}

await authorize(input.clientId, input.clientSecret, async token => {
    const users = await getUsers(
        input.clientId,
        token,
        { logins: [input.broadcasterName] }
    );
    if (users.data.length) {
        await subscribe(
            input.clientId,
            token,
            users.data[0].id,
            input.callback,
            input.clientSecret
        );
        console.log(`Subscribed callback "${input.callback}" to user "${input.broadcasterName}" (ID: ${users.data[0].id})`);
    }
    else {
        console.log(`Unable to find user: ${input.broadcasterName}`);
    }
});
