import { Stack } from "expo-router";
import { UserProvider } from "../src/context/UserContext";
import { SessionProvider } from "../src/context/SessionContext";

export default function RootLayout() {
  return (
    <UserProvider>
      <SessionProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </SessionProvider>
    </UserProvider>
  );
}
