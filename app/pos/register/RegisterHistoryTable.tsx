import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { registerDate, registerMoney } from "./register-ui-utils";
import type { RegisterSession } from "./types";

interface Props {
  sessions: RegisterSession[];
  loading: boolean;
  error: string | null;
  onSelect: (session: RegisterSession) => void;
}

export function RegisterHistoryTable({ sessions, loading, error, onSelect }: Props) {
  const emptyMessage = error
    ? "Register history is unavailable. Close and reopen this dialog to try again."
    : "No closed register sessions at this location.";

  return (
    <div className="overflow-hidden rounded-md border">
      {loading && <span role="status" className="sr-only">Loading register history…</span>}
      <Table aria-label="Register history" aria-busy={loading} className="min-w-[520px] table-auto">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Session</TableHead>
            <TableHead scope="col">Opened</TableHead>
            <TableHead scope="col">Closed</TableHead>
            <TableHead scope="col" className="text-right">Expected cash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? <RegisterHistorySkeleton /> : <>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <Button type="button" variant="link" className="h-auto max-w-40 whitespace-normal break-all p-0 text-left" onClick={() => onSelect(session)}>
                    Session {session.id}
                  </Button>
                  <span className="block text-xs capitalize text-muted-foreground">{session.status}</span>
                </TableCell>
                <TableCell>{registerDate(session.opened_at)}</TableCell>
                <TableCell>{registerDate(session.closed_at)}</TableCell>
                <TableCell className="text-right tabular-nums">{session.expected_amount === null ? "Not closed" : registerMoney(session.expected_amount, session.currency)}</TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{emptyMessage}</TableCell>
              </TableRow>
            )}
          </>}
        </TableBody>
      </Table>
    </div>
  );
}

function RegisterHistorySkeleton() {
  return Array.from({ length: 5 }, (_, index) => (
    <TableRow key={index} data-slot="register-history-skeleton" aria-hidden="true" className="hover:bg-transparent">
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-12 motion-reduce:animate-none" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-28 motion-reduce:animate-none" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28 motion-reduce:animate-none" /></TableCell>
      <TableCell><Skeleton className="ml-auto h-4 w-20 motion-reduce:animate-none" /></TableCell>
    </TableRow>
  ));
}