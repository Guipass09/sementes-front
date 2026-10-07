import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// The iframe load event only means the document loaded; the activity may still be fetching data.
export function useSessionContentStatus(loading: boolean, hasContent: boolean) {
  const { search } = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const hideHeading = params.get("session") === "1" && params.get("session_role") === "user" && !!params.get("story_id");
    if (hideHeading) document.documentElement.classList.add("story-session-patient");
    return () => document.documentElement.classList.remove("story-session-patient");
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("session") !== "1" || window.parent === window) return;
    const shareId = params.get("session_content_id");
    if (!shareId) return;

    window.parent.postMessage(
      {
        type: "SESSION_CONTENT_STATE",
        share_id: shareId,
        status: loading ? "loading" : hasContent ? "ready" : "failed",
      },
      window.location.origin,
    );
  }, [search, loading, hasContent]);
}
