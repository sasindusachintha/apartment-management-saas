import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, AlertCircle, Loader2, Clock } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  actorUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  metadata?: Record<string, unknown> | null;
}

export default function AuditLogsPage() {
  const { activeOrg } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = activeOrg ? `/audit-logs?organizationId=${activeOrg.id}` : '/audit-logs';
      const { data } = await api.get(url);
      setLogs(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch audit records';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
          Security Audit Trail
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Immutable log of security events and administrative actions in{' '}
          {activeOrg?.name || 'your scope'}
        </p>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'hsl(0, 84%, 15%)',
            border: '1px solid var(--color-danger-500)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            color: 'hsl(0, 100%, 90%)',
          }}
        >
          <AlertCircle size={20} color="var(--color-danger-500)" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <Loader2
            size={32}
            style={{ animation: 'spin 1s linear infinite', color: 'var(--color-brand-400)' }}
          />
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-3)' }}>
            Loading audit trail...
          </p>
        </div>
      ) : logs.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <ShieldAlert size={48} color="var(--color-text-muted)" />
          <h3>No Audit Records Recorded</h3>
          <p
            style={{ color: 'var(--color-text-secondary)', maxWidth: '420px', fontSize: '0.9rem' }}
          >
            No security actions have occurred yet in this tenant scope.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <div className="table-header">
            <span className="table-header__title">Audit Trail Records ({logs.length})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Target Entity</th>
                <th>IP / Client</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          log.action.includes('FAILED') || log.action.includes('REUSE')
                            ? 'hsl(0, 84%, 20%)'
                            : 'hsl(239, 84%, 20%)',
                        color:
                          log.action.includes('FAILED') || log.action.includes('REUSE')
                            ? 'hsl(0, 100%, 90%)'
                            : 'hsl(239, 100%, 90%)',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    {log.actorUser ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{log.actorUser.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {log.actorUser.email}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        System / Anonymous
                      </span>
                    )}
                  </td>
                  <td>
                    <div>
                      <span style={{ fontWeight: 600 }}>{log.entityType}</span>
                      {log.entityId && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          ID: {log.entityId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {log.ipAddress || '—'}
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.8rem',
                      }}
                    >
                      <Clock size={12} color="var(--color-text-muted)" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
