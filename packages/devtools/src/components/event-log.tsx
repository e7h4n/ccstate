import { StoreEvent, type PackedEventMessage, type State } from 'ccstate';
import { useGet, useSet } from 'ccstate/react';
import {
  clearEvents$,
  filterLabel$,
  selectedFilter$,
  storeEvents$,
  toggleFilter$,
  updateFilterLabel$,
} from '../atoms/events';
import { type HTMLAttributes, type ReactNode } from 'react';

export function EventLog(props: HTMLAttributes<HTMLDivElement>) {
  const event$s = useGet(storeEvents$);
  const clearEvents = useSet(clearEvents$);
  const filterLabel = useGet(filterLabel$);
  const updateFilterLabel = useSet(updateFilterLabel$);

  return (
    <div className="h-full flex flex-col bg-white" {...props}>
      <div className="p-2 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f3f3f3]">
        <div className="flex items-center gap-2">
          <button
            className="w-[20px] h-[20px] flex items-center justify-center rounded hover:bg-[#e0e0e0] text-[#666]"
            onClick={clearEvents}
            data-testid="clear-events"
          >
            <svg viewBox="0 0 24 24" className="w-[14px] h-[14px]" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          <TypeFilter />
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="filter atom label"
            className="h-[20px] pl-[20px] pr-2 rounded text-[11px] bg-white border border-[#ccc] focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3] placeholder:text-[#999]"
            value={filterLabel}
            onChange={(e) => {
              updateFilterLabel(e.target.value);
            }}
          />
          <svg
            className="absolute left-[4px] top-1/2 -translate-y-1/2 w-[12px] h-[12px] text-[#666]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full border-collapse text-[11px] leading-[14px]">
          <thead>
            <tr className="bg-[#f3f3f3] text-[#5f6368]">
              <th className="text-left py-[3px] px-[6px] font-normal border-b border-[#e0e0e0]">ID</th>
              <th className="text-left py-[3px] px-[6px] font-normal border-b border-[#e0e0e0]">Op</th>
              <th className="text-left py-[3px] px-[6px] font-normal border-b border-[#e0e0e0]">Atom</th>
              <th className="text-left py-[3px] px-[6px] font-normal border-b border-[#e0e0e0]">State</th>
            </tr>
          </thead>
          <tbody className="text-[#333]">
            {event$s.map((event$) => (
              <EventRow key={event$.toString()} event$={event$} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventRow({ event$ }: { event$: State<PackedEventMessage> }) {
  const event = useGet(event$);

  const rowData: (string | number | ReactNode | null)[] = [];

  // 通用字段
  rowData.push(event.eventId);
  rowData.push(event.type.toUpperCase());
  rowData.push(event.targetAtom);
  rowData.push(event.state);

  return (
    <tr data-testid="event-row">
      {rowData.map((cell, i) => (
        <td key={i} className="py-[3px] px-[6px] border-b border-[#e0e0e0]">
          {cell}
        </td>
      ))}
    </tr>
  );
}

function TypeFilter() {
  const selectedFilter = useGet(selectedFilter$);
  const toggleFilter = useSet(toggleFilter$);

  function Label({ filter }: { filter: StoreEvent['type'] }) {
    return (
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          className="w-3 h-3"
          value={filter}
          checked={selectedFilter.has(filter)}
          onChange={() => {
            toggleFilter(filter);
          }}
        />
        {filter}
      </label>
    );
  }

  return (
    <div className="flex gap-2 ml-2 text-[11px] text-[#666] items-center">
      <Label filter="get" />
      <Label filter="set" />
      <Label filter="sub" />
      <Label filter="unsub" />
      <Label filter="mount" />
      <Label filter="unmount" />
      <Label filter="notify" />
    </div>
  );
}
