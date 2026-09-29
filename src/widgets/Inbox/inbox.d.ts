import { type IInboxMessagePublic } from '../../models/InboxMessages.types';

interface Ipwinbox {
  readMessagesWithCodes(codes: Array<string>): Promise<void>;
  loadMessages(): Promise<Array<IInboxMessagePublic>>;
  unreadMessagesCount(): Promise<number>;
  performActionForMessageWithCode(code: string): Promise<void>;
  deleteMessagesWithCodes(codes: Array<string>): Promise<void>;
}
