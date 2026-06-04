import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { calendarService } from '@/services/calendar';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner } from '@/components/ui';

const LEGEND = [
  { label: 'Critical 6', color: '#ef4444' },
  { label: 'Action Plan', color: '#3b6fff' },
  { label: 'Key Result', color: '#10b981' },
];

export default function CalendarView() {
  const events = useQuery({ queryKey: ['calendar'], queryFn: () => calendarService.events() });

  return (
    <>
      <PageHeader title="Calendar" subtitle="마감일 기준 — Critical 6 · Action Plan · KR"
        action={
          <div className="flex gap-3 text-xs">
            {LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.label}
              </span>
            ))}
          </div>
        } />

      <Card>
        {events.isLoading ? <Spinner /> : (
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate="2026-06-01"
            height="auto"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
            events={events.data ?? []}
            eventDisplay="block"
            dayMaxEvents={3}
          />
        )}
      </Card>
    </>
  );
}
