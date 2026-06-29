import React from "react";
import type { OwnerRow } from "@/hooks/useOwners";

export interface OwnerPickerProps {
  owners: OwnerRow[];
  loading: boolean;
  error: string | null;
  selectedOwnerId: string | null;
  onSelect: (ownerId: string) => void;
  onRefresh: () => void;
}

export const OwnerPicker: React.FC<OwnerPickerProps> = ({
  owners,
  loading,
  error,
  selectedOwnerId,
  onSelect,
  onRefresh,
}) => {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
        Loading owners from admin...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (owners.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
        No owners registered in admin yet.{" "}
        <a
          href="http://127.0.0.1:9001/owners"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-amber-900"
        >
          Create one in admin
        </a>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-2 text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-300 overflow-hidden bg-white">
        <select
          value={selectedOwnerId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="" disabled>
            Select owner...
          </option>
          {owners.map((owner) => (
            <option
              key={owner.owner_id}
              value={owner.owner_id}
              disabled={owner.status !== "active"}
            >
              {owner.display_name} ({owner.owner_id})
              {owner.status !== "active" ? ` - ${owner.status}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedOwnerId && (() => {
        const owner = owners.find((item) => item.owner_id === selectedOwnerId);
        if (!owner) return null;
        return (
          <div className="text-xs text-slate-500">
            Kind: <span className="font-mono">{owner.kind}</span> · Status:{" "}
            <span className="font-mono">{owner.status}</span>
          </div>
        );
      })()}

      <button
        type="button"
        onClick={onRefresh}
        className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
      >
        Refresh list
      </button>
    </div>
  );
};
