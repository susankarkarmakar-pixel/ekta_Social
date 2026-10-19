import { useEffect, useState } from "react";
import { getProfilesByIds, getProfileById } from "./profile-lookup";
import type { Profile } from "./types";

export function useParticipants(ids: string[]) {
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);

  // Stable key from sorted unique ids
  const idKey = Array.from(new Set(ids)).sort().join(",");

  useEffect(() => {
    let mounted = true;

    const fetchProfiles = async () => {
      if (!idKey) {
        setProfiles(new Map());
        setLoading(false);
        return;
      }

      setLoading(true);
      const uniqueIds = idKey.split(",");
      const result = await getProfilesByIds(uniqueIds);

      if (mounted) {
        setProfiles(result);
        setLoading(false);
      }
    };

    void fetchProfiles();

    return () => {
      mounted = false;
    };
  }, [idKey]);

  return { profiles, loading };
}

export function useParticipant(id: string | undefined) {
  const [profile, setProfile] = useState<Profile | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!id) {
        setProfile(undefined);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getProfileById(id);

      if (mounted) {
        setProfile(result);
        setLoading(false);
      }
    };

    void fetchProfile();

    return () => {
      mounted = false;
    };
  }, [id]);

  return { profile, loading };
}
