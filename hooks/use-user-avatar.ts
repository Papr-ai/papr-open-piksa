import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface UserAvatarData {
  image: string | null;
  name: string | null;
  email: string | null;
}

export function useUserAvatar() {
  const { data: session, update: updateSession } = useSession();
  const [avatarData, setAvatarData] = useState<UserAvatarData>({
    image: null,
    name: null,
    email: null
  });
  const [isLoading, setIsLoading] = useState(false);

  // Update avatar data when session changes
  useEffect(() => {
    if (session?.user) {
      setAvatarData({
        image: session.user.image || null,
        name: session.user.name || null,
        email: session.user.email || null
      });
    }
  }, [session]);

  // Set loading state based on session status
  useEffect(() => {
    if (session?.user?.id) {
      setIsLoading(false); // Session is loaded, stop loading
    }
  }, [session?.user?.id]);

  return {
    userImage: avatarData.image,
    userName: avatarData.name,
    userEmail: avatarData.email,
    isLoading,
    refreshSession: updateSession
  };
}
