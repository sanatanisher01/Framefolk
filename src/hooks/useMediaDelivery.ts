"use client";
import { useEffect, useState } from "react";
import { getSignedDeliveryUrl } from "@/services/upload.service";

export function useMediaDelivery(mediaId?: string | null, thumbnail = false) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    const load = () => {
      if (mediaId) getSignedDeliveryUrl(mediaId, thumbnail).then(value => { if (active) setUrl(value); }).catch(() => { if (active) setUrl(""); });
    };
    load();
    const timer = setInterval(load, 50 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [mediaId, thumbnail]);
  return url;
}
