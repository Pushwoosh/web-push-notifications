export interface ISubscriptionPromptWidgetParams {
  headerText: string;
  headerTextColor: string;
  subheaderText?: string;
  subheaderTextColor?: string;

  buttonAcceptText: string;
  buttonAcceptTextColor: string;
  buttonAcceptRound: string;
  buttonAcceptBackgroundColor: string;
  buttonAcceptBorderColor: string;

  buttonCancelText: string;
  buttonCancelTextColor: string;
  buttonCancelRound: string;
  buttonCancelBackgroundColor: string;
  buttonCancelBorderColor: string;

  cappingCount: number;
  cappingDelay: number;

  backgroundColor: string;
}
