import type { SignalUserType } from '../../types/Signal.ts';
import { SafeError } from '../Error.ts';

export class SignalUserValidationError extends SafeError {
  name = 'signal_user_validation_error';

  constructor(messages: { safe: string; unsafe?: string }) {
    super('signal_user_validation_error', messages);
    this.safeMessage = messages.safe;
    this.unsafeMessage = messages.unsafe;
  }
}

export class SignalUser implements SignalUserType {
  /**
   * [source](https://support.signal.org/hc/en-us/articles/6712070553754-Phone-Number-Privacy-and-Usernames)
   *
   * Username requirements
   * Usernames can be between 3 and 32 characters.
   * You must include at least two digits at the end of your username.
   * Usernames may only contain a-z, 0-9 and _.
   * Note: usernames are case insensitive.
   *
   * [experimenting in iOS app]
   * Usernames may only start with a-z or _
   * The 2 digits at the end don't count toward the 32-character max length
   */
  static username_regex = /^[a-z_]{1}[a-z0-9_]{2,31}\.\d{2}$/;

  // accept international codes of 1-3 digits. E.g., +12223334444, +8522223334444
  static phone_regex = /^\+\d{1,3}\d{10}$/;

  username?: string;
  phone?: string;

  identifier: string;

  constructor(props: { username?: string; phone?: string }) {
    if (props.username) {
      if (SignalUser.username_regex.test(props.username.toLowerCase())) {
        this.username = props.username.toLowerCase();
      } else {
        throw new SignalUserValidationError({
          safe: `Invalid username: must match ${SignalUser.username_regex.toString()}`,
          unsafe: `props: ${JSON.stringify(props)}`,
        });
      }
    }

    if (props.phone) {
      if (SignalUser.phone_regex.test(props.phone)) {
        this.phone = props.phone;
      } else {
        throw new SignalUserValidationError({
          safe: `Invalid phone number: must match ${SignalUser.phone_regex.toString()}`,
          unsafe: `props: ${JSON.stringify(props)}`,
        });
      }
    }

    this.identifier = (() => {
      const _id = this.username ? this.username : this.phone;
      if (_id) {
        return _id;
      } else {
        throw new SignalUserValidationError({
          safe: 'Neither valid username nor phone provided',
          unsafe: `props: ${JSON.stringify(props)}`,
        });
      }
    })();
  }
}
