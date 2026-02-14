// src/features/schedule/components/ScheduleBuilder.tsx
import React from 'react';
import { Box, HStack } from '@chakra-ui/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid'; 
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import { useSchedule } from '../hook/useSchedule';
import { CalendarSidebar } from './CalendarSidebar';

export const ScheduleBuilder: React.FC = () => {
  const { 
    playlists, 
    events, 
    fetchSchedule, 
    handleEventReceive, 
    handleEventClick 
  } = useSchedule();

  return (
    <HStack align="stretch" gap={6} h="75vh" data-theme="light">
      <CalendarSidebar playlists={playlists} />

      <Box flex="1" bg="white" p={4} borderRadius="xl" borderWidth="1px" borderColor="gray.200" overflow="hidden">
        <Box css={{
          "& .fc-toolbar": { 
            mb: "16px !important",
            alignItems: "center !important", // Center left/right chunks vertically
          },
          "& .fc-toolbar-chunk": {
            display: "flex",
            alignItems: "center", // Force buttons and title onto the same line
            gap: "8px"
          },
          "& .fc-toolbar-title": { 
            fontSize: "1.25rem !important", 
            fontWeight: "600 !important", 
            color: "var(--chakra-colors-gray-800)",
            margin: "0 0 0 8px !important", // Reset margins to prevent wrapping
            lineHeight: "1 !important"
          },

          // --- Header Grid Styling ---
          "& .fc-theme-standard th": { border: "none", borderBottom: "1px solid var(--chakra-colors-gray-200)" },
          "& .fc-col-header-cell-cushion": { display: "block", width: "100%", padding: "4px 0" }, // Tighter padding
          "& .fc-col-header-cell": { paddingTop: "4px", paddingBottom: "4px" },
          
          // --- Button Styling (More compact) ---
          "& .fc-button": { padding: "0.3em 0.8em !important", fontSize: "0.9em !important" }, // Smaller buttons
          "& .fc-button-primary": {
            backgroundColor: "white !important",
            borderColor: "var(--chakra-colors-gray-300) !important",
            color: "var(--chakra-colors-gray-700) !important",
            textTransform: "capitalize",
            borderRadius: "6px"
          },
          "& .fc-button-primary:not(:disabled):hover": {
            backgroundColor: "var(--chakra-colors-gray-50) !important",
          },
          "& .fc-button-active": {
            backgroundColor: "var(--chakra-colors-blue-50) !important",
            color: "var(--chakra-colors-blue-600) !important",
            borderColor: "var(--chakra-colors-blue-200) !important",
          },
          
          // --- Grid Styling (Compact Slots) ---
          "& .fc-timegrid-slot-label-cushion": { 
            fontWeight: "normal", 
            color: "var(--chakra-colors-gray-500)",
            fontSize: "11px", // Smaller time text
            paddingRight: "8px"
          },
          // FIX: Reduced slot height from 48px to 24px so you see twice as many hours!
          "& .fc-timegrid-slot": { height: "24px" }, 
          "& .fc-event": { cursor: "pointer", borderRadius: "4px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", padding: "2px" },
          "& .fc-event-main": { fontSize: "11px", lineHeight: "1.2" } // Smaller text inside the events
        }} h="100%">
          
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            
            headerToolbar={{
              left: 'today prev,next title',
              center: '',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            
            // --- Custom Day Headers (Shrunk) ---
            dayHeaderContent={(args) => {
              const weekday = args.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              const dayNumber = args.date.getDate();
              const isToday = args.isToday;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ 
                    fontSize: '10px', // Shrunk
                    fontWeight: 600, 
                    color: isToday ? 'var(--chakra-colors-blue-600)' : '#718096' 
                  }}>
                    {weekday}
                  </span>
                  <span style={{ 
                    fontSize: '16px', // Shrunk from 20px
                    fontWeight: 400, 
                    color: isToday ? 'white' : '#1A202C',
                    backgroundColor: isToday ? 'var(--chakra-colors-blue-500)' : 'transparent',
                    borderRadius: '50%',
                    width: '28px', // Shrunk from 38px
                    height: '28px', // Shrunk from 38px
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {dayNumber}
                  </span>
                </div>
              );
            }}

            slotDuration="00:15:00" 
            slotEventOverlap={false} 
            allDaySlot={false}
            editable={false} 
            droppable={true} 
            events={events}
            datesSet={(info) => {
              fetchSchedule(info.startStr, info.endStr);
            }}
            eventReceive={handleEventReceive}
            eventClick={handleEventClick}
            height="100%"
            slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'lowercase' }}
            scrollTime="08:00:00"
            nowIndicator={true} 
          />
        </Box>
      </Box>
    </HStack>
  );
};