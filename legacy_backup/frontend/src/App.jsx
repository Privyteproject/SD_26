import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { I18nProvider } from "./app/providers/I18nProvider";
import { SessionProvider } from "./app/providers/SessionProvider";
import AppRoutes from "./app/router/routes";

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
