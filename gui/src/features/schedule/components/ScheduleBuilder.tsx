import React from 'react';
import { Box, HStack, Flex, Heading } from '@chakra-ui/react';
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
    <Flex direction="column" h="full" w="full" gap={6} data-theme="light" bg="transparent">
      
      {/* 1. MINIMAL HEADER (Matches the new Playlist views) */}
      <Flex justify="space-between" align="end" px={1}>
        <Heading size="lg" fontWeight="semibold" color="gray.900" letterSpacing="tight">
          Broadcast Schedule
        </Heading>
      </Flex>

      <HStack align="stretch" gap={6} flex="1" minH="0">
        
        {/* Sidebar */}
        <Box w="320px" bg="white" borderRadius="2xl" shadow="sm" border="1px solid" borderColor="gray.100" overflow="hidden">
           <CalendarSidebar playlists={playlists} />
        </Box>

        {/* Calendar Main Body */}
        <Box 
          flex="1" 
          bg="white" 
          p={6} 
          borderRadius="2xl" 
          shadow="sm" 
          border="1px solid" 
          borderColor="gray.100" 
          overflow="hidden"
        >
          <Box css={{
            // --- 1. GLOBAL CALENDAR VARIABLES ---
            "& .fc": {
              "--fc-border-color": "var(--chakra-colors-gray-100)", // Whisper thin, light grid lines
              "--fc-today-bg-color": "var(--chakra-colors-gray-50)", // Subtle highlight for today
              "--fc-now-indicator-color": "var(--chakra-colors-blue-500)", // Brand color for current time
              "--fc-event-border-color": "transparent",
              fontFamily: "inherit",
              height: "100%",
            },

            // --- 2. TOOLBAR & BUTTONS (The Pill Look) ---
            "& .fc-toolbar": { 
              mb: "24px !important",
            },
            "& .fc-toolbar-title": { 
              fontSize: "1.25rem !important", 
              fontWeight: "700 !important", 
              color: "var(--chakra-colors-gray-900)",
              letterSpacing: "-0.02em"
            },
            "& .fc-button": { 
              padding: "8px 16px !important", 
              fontSize: "0.85rem !important",
              fontWeight: "600 !important",
              textTransform: "capitalize",
              borderRadius: "9999px !important", // Pill shape
              boxShadow: "none !important",
              transition: "all 0.2s"
            },
            "& .fc-button-primary": {
              backgroundColor: "white !important",
              borderColor: "var(--chakra-colors-gray-200) !important",
              color: "var(--chakra-colors-gray-600) !important",
            },
            "& .fc-button-primary:not(:disabled):hover": {
              backgroundColor: "var(--chakra-colors-gray-50) !important",
              color: "var(--chakra-colors-gray-900) !important",
            },
            "& .fc-button-active": {
              backgroundColor: "var(--chakra-colors-gray-900) !important", // Black pill for active state
              color: "white !important",
              borderColor: "var(--chakra-colors-gray-900) !important",
            },

            // --- 3. GRID & AXIS CLEANUP ---
            "& .fc-scrollgrid": { border: "none !important" }, // Kill the outer border
            "& .fc-theme-standard th": { 
              border: "none", 
              borderBottom: "1px solid var(--chakra-colors-gray-100)" 
            },
            "& .fc-col-header-cell": { paddingBottom: "12px" },
            
            "& .fc-timegrid-axis-cushion": { 
              fontSize: "11px", 
              color: "var(--chakra-colors-gray-400)", 
              fontWeight: "500",
              textTransform: "uppercase"
            },
            "& .fc-timegrid-slot-label-cushion": { 
              fontWeight: "500", 
              color: "var(--chakra-colors-gray-400)",
              fontSize: "11px",
              paddingRight: "12px"
            },
            "& .fc-timegrid-slot-minor": { borderTopStyle: "dashed !important" }, // Dashed lines for 15m/30m marks
            "& .fc-timegrid-slot": { height: "30px" }, // Slightly taller for breathing room
            
            // --- 4. FLOATING EVENTS ---
            "& .fc-event": { 
              cursor: "pointer", 
              borderRadius: "8px", // Soft event corners
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)", 
              padding: "4px 6px",
              transition: "transform 0.1s, box-shadow 0.1s",
            },
            "& .fc-event:hover": {
              transform: "translateY(-1px)",
              boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
            },
            "& .fc-event-main": { 
              fontSize: "11px", 
              fontWeight: "600",
              lineHeight: "1.3",
              color: "white" // Assumes your playlist colors are vibrant
            },
            // Makes the current time line a bit sleeker
            "& .fc-timegrid-now-indicator-arrow": { border: "none", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--chakra-colors-blue-500)", marginLeft: "-4px", marginTop: "-4px" },
            "& .fc-timegrid-now-indicator-line": { borderTopWidth: "2px" }
          }} h="100%">
            
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              eventOverlap={false}
              selectOverlap={false}
              
              headerToolbar={{
                left: 'title',
                center: '',
                right: 'today prev,next timeGridWeek,timeGridDay'
              }}
              
              // --- Custom Day Headers (Bridge.audio Style) ---
              dayHeaderContent={(args) => {
                const weekday = args.date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNumber = args.date.getDate();
                const isToday = args.isToday;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: isToday ? 'var(--chakra-colors-blue-600)' : 'var(--chakra-colors-gray-400)' 
                    }}>
                      {weekday}
                    </span>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: isToday ? 700 : 500, 
                      color: isToday ? 'white' : 'var(--chakra-colors-gray-800)',
                      backgroundColor: isToday ? 'var(--chakra-colors-blue-600)' : 'transparent',
                      borderRadius: '50%',
                      width: '32px', 
                      height: '32px', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isToday ? '0 2px 4px rgba(49, 130, 206, 0.3)' : 'none'
                    }}>
                      {dayNumber}
                    </span>
                  </div>
                );
              }}

              slotDuration="00:15:00" 
              slotEventOverlap={false} 
              allDaySlot={false}
              editable={true} // Usually you want this true for dragging events around!
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
    </Flex>
  );
};