export async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    if (
      response.status === 401 &&
      url.startsWith("/api/") &&
      !url.startsWith("/api/auth/")
    )
      navigateSession("/login");
    throw new Error(data.error || "Não foi possível concluir.");
  }
  return data as T;
}

// Full navigation clears cached protected pages after authentication changes.
export function navigateSession(path: "/login" | "/dashboard") {
  window.location.assign(path);
}
