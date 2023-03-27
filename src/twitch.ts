import { HMAC_PREFIX, RequestHeaders } from "twitch-eventsub-utils";
import {
    hexBuffer,
    requestHeader,
    stringBuffer
} from "./utils.js";

async function getKey(secret: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        "raw",
        stringBuffer(secret),
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

export async function verifyRequest(secret: string, request: Request, body: Blob): Promise<boolean> {
    const signature = requestHeader(request, RequestHeaders.MessageSignature);
    const [key, message] = await Promise.all([
        getKey(secret),
        getHmacMessage(request, body)
    ]);
    return await crypto.subtle.verify(
        "HMAC",
        key,
        hexBuffer(signature.startsWith(HMAC_PREFIX) ? signature.slice(HMAC_PREFIX.length) : signature),
        message
    );
}
