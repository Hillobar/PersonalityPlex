import { createContext, useContext } from "react";

type ConversationStateType = {
  audioURL: string;
  isMediaReady: boolean;
  socketColor: string;
};

export const ConversationStateContext = createContext<ConversationStateType>({
  audioURL: "",
  isMediaReady: false,
  socketColor: "bg-red-400",
});

export const useConversationState = () => {
  return useContext(ConversationStateContext);
};
