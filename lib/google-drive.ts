import type { UnderstudyIdentity } from "@/lib/personal-workspace";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type PickerFile = {
  id: string;
  name: string;
  mimeType: string;
};

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

export function googleDriveConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID &&
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  );
}

export async function connectGoogleDrive(): Promise<{
  accessToken: string;
  identity: UnderstudyIdentity;
}> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Google client ID is not configured.");

  await loadScript(GIS_SRC);
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services did not load.");
  }

  const token = await new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile https://www.googleapis.com/auth/drive.file",
      prompt: "consent",
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description || response.error || "Google authorization failed.",
            ),
          );
          return;
        }
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!profileResponse.ok) throw new Error("Could not read Google profile.");
  const profile = (await profileResponse.json()) as {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  return {
    accessToken: token,
    identity: {
      id: `google:${profile.sub}`,
      name: profile.name || profile.email || "Google user",
      email: profile.email,
      avatarUrl: profile.picture,
      provider: "google",
    },
  };
}

async function loadPicker() {
  await loadScript(GAPI_SRC);
  if (!window.gapi) throw new Error("Google API loader did not load.");
  await new Promise<void>((resolve) => window.gapi.load("picker", { callback: resolve }));
}

export async function pickGoogleDriveFile(accessToken: string): Promise<PickerFile | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Google API key is not configured.");

  await loadPicker();
  if (!window.google?.picker) throw new Error("Google Picker did not load.");

  return new Promise<PickerFile | null>((resolve) => {
    const view = new window.google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .setTitle("Choose work evidence for Understudy")
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data: any) => {
        const action = data?.[window.google.picker.Response.ACTION];
        if (action === window.google.picker.Action.CANCEL) {
          resolve(null);
          return;
        }
        if (action !== window.google.picker.Action.PICKED) return;
        const doc = data?.[window.google.picker.Response.DOCUMENTS]?.[0];
        if (!doc) {
          resolve(null);
          return;
        }
        resolve({
          id: String(doc[window.google.picker.Document.ID]),
          name: String(doc[window.google.picker.Document.NAME] || "Google Drive file"),
          mimeType: String(doc[window.google.picker.Document.MIME_TYPE] || ""),
        });
      })
      .build();

    picker.setVisible(true);
  });
}

export async function readGoogleDriveFile(accessToken: string, picked: PickerFile) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(picked.id)}?fields=id,name,mimeType,modifiedTime`,
    { headers },
  );
  if (!metadataResponse.ok) throw new Error("Understudy could not read the selected file metadata.");
  const metadata = (await metadataResponse.json()) as {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
  };

  let contentUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}?alt=media`;
  if (metadata.mimeType === "application/vnd.google-apps.document") {
    contentUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}/export?mimeType=text%2Fplain`;
  } else if (metadata.mimeType === "application/vnd.google-apps.spreadsheet") {
    contentUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(metadata.id)}/export?mimeType=text%2Fcsv`;
  } else if (
    !metadata.mimeType.startsWith("text/") &&
    !["application/json", "text/markdown", "text/csv"].includes(metadata.mimeType)
  ) {
    throw new Error(
      "This build can read Google Docs, Sheets, and text-based Drive files. Upload PDFs/DOCX directly after document parsing is added.",
    );
  }

  const contentResponse = await fetch(contentUrl, { headers });
  if (!contentResponse.ok) throw new Error("Understudy could not download the selected file.");
  const text = await contentResponse.text();
  if (!text.trim()) throw new Error("The selected file did not contain readable text.");

  return {
    title: metadata.name,
    text: text.slice(0, 60_000),
    meta: metadata.modifiedTime,
  };
}
