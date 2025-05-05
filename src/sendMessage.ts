import { config } from './config.ts';

// to extend this functionality, see API documentation for https://github.com/bbernhard/signal-cli-rest-api
export default async function sendMessage(
  message: string,
  recipients: string[],
) {
  try {
    const input = new URL(config.signal_service.base_url);
    input.pathname = '/v2/send';

    const response = await fetch(input, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        number: config.from_number,
        recipients, // can be a DM (phone number or username) or group chat (group ID -- look up with list groups API)
      }),
    });
    const data = await response.json();
    const timestamp = new Date(Number.parseInt(data.timestamp));
    return { timestamp };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
