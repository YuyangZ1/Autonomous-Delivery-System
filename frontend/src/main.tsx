import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Providers } from "@/app/providers";
import { AuthProvider } from "@/context/AuthContext";
import { AppRouter } from "@/app/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string} language="en" region="US">
        <Providers>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </Providers>
      </APIProvider>
    </BrowserRouter>
  </StrictMode>,
);
