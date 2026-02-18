"use client";

import type { Key, ReactNode } from "react";

type RenderItem<T> = (item: T, index: number) => ReactNode;
type GetKey<T> = (item: T, index: number) => Key;

interface SearchResultListProps<T> {
  items: T[];
  emptyMessage: string;
  renderItem: RenderItem<T>;
  getKey: GetKey<T>;
  className?: string;
}

export default function SearchResultList<T>({
  items,
  emptyMessage,
  renderItem,
  getKey,
  className,
}: SearchResultListProps<T>) {
  return (
    <div
      className={
        className ??
        "bg-base-200 border-neutral divide-neutral divide-y overflow-hidden rounded-md border"
      }
    >
      {items.length > 0 ? (
        items.map((item, index) => <div key={getKey(item, index)}>{renderItem(item, index)}</div>)
      ) : (
        <div className="text-base-content/50 py-20 text-center">{emptyMessage}</div>
      )}
    </div>
  );
}
