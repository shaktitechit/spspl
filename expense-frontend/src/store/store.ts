import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./api/baseApi";

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

let clientStore: AppStore | undefined;

export function getBrowserStore(): AppStore {
  if (typeof window === "undefined") {
    return makeStore();
  }
  clientStore ??= makeStore();
  return clientStore;
}
