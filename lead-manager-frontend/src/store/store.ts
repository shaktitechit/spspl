import { combineReducers, configureStore, type Middleware } from "@reduxjs/toolkit";
import { baseApi } from "./api/baseApi";
import { mutationToastMiddleware } from "./mutation-toast-middleware";
import authReducer, {
  hydrateAuthState,
  writeAuthToStorage,
} from "./slices/authSlice";

const rootReducer = combineReducers({
  auth: authReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Session changes persist in cookies via authStorage. */
const authPersistMiddleware =
  (): Middleware<Record<string, never>, RootState> =>
  () =>
  (next) =>
  (action) => {
    return next(action);
  };

/** Each call creates a fresh store instance. Hydrates auth from LS on browser only. */
export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    preloadedState:
      typeof window !== "undefined"
        ? { auth: hydrateAuthState() }
        : undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(baseApi.middleware)
        .concat(authPersistMiddleware())
        .concat(mutationToastMiddleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

let clientStore: AppStore | undefined;

/** Browser singleton (StrictMode-safe). On the server uses a throwaway empty store instance. */
export function getBrowserStore(): AppStore {
  if (typeof window === "undefined") {
    return makeStore();
  }
  clientStore ??= makeStore();
  return clientStore;
}
