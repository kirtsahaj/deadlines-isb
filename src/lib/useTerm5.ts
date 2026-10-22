import { useQuery } from "@tanstack/react-query";
import { getMyTerm5 } from "@/lib/term5.functions";
import { useSession } from "@/lib/useSession";

export function useTerm5() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["term5", user?.id],
    queryFn: () => getMyTerm5(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}
