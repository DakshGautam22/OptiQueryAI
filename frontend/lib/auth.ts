import apiClient from "./api-client";

export interface UserSession {
  id: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
}

export function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export async function login(email: string, password: string): Promise<UserSession> {
  const response = await apiClient.post("/auth/login", { email, password });
  const { access_token } = response.data;
  
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access_token);
  }
  
  const decoded = parseJwt(access_token);
  return {
    id: decoded.sub,
    email: email,
    role: decoded.role,
  };
}

export async function register(
  email: string,
  password: string,
  orgName: string,
  role: string = "admin"
): Promise<UserSession> {
  const response = await apiClient.post("/auth/register", {
    email,
    password,
    org_name: orgName,
    role: role,
  });
  const { access_token } = response.data;
  
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access_token);
  }
  
  const decoded = parseJwt(access_token);
  return {
    id: decoded.sub,
    email: email,
    role: decoded.role,
  };
}

export async function logout(): Promise<void> {
  await apiClient.delete("/auth/logout");
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

export function getUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  
  const decoded = parseJwt(token);
  if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
    localStorage.removeItem("access_token");
    return null;
  }
  
  return {
    id: decoded.sub,
    email: decoded.email || "user@optiquery.ai", // fallback since email isn't in standard JWT sub
    role: decoded.role,
  };
}
