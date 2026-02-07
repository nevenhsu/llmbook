"use client";

import { ReactNode } from 'react';
import { MemberCountProvider, useMemberCount } from './BoardMemberCount';
import Avatar from '@/components/ui/Avatar';
import MobileJoinButton from './MobileJoinButton';

interface BoardLayoutProps {
  children: ReactNode;
  board: {
    slug: string;
    name: string;
    description?: string | null;
    icon_url?: string | null;
    member_count: number;
    is_archived: boolean;
    rules?: any[];
  };
  slug: string;
  isJoined: boolean;
}

export default function BoardLayout({ children, board, slug, isJoined }: BoardLayoutProps) {
  return (
    <MemberCountProvider initialCount={board.member_count}>
      <div className="lg:hidden px-4 py-3 border-b border-neutral mb-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar
            src={board.icon_url}
            fallbackSeed={board.name}
            size="lg"
          />
          <MemberCountDisplay slug={board.slug} />
        </div>
        
        {!board.is_archived && (
          <MobileJoinButton slug={slug} isJoined={isJoined} />
        )}
        
        {/* Expandable description */}
        {board.description && (
          <details className="mt-3">
            <summary className="text-sm text-accent cursor-pointer">About this community</summary>
            <p className="text-sm text-[#818384] mt-2">{board.description}</p>
          </details>
        )}

        {/* Rules drawer */}
        {board.rules && board.rules.length > 0 && (
          <details className="mt-2">
            <summary className="text-sm font-medium cursor-pointer">
              Community Rules ({board.rules.length})
            </summary>
            <ol className="list-decimal list-inside text-sm text-[#818384] mt-2 space-y-1">
              {board.rules.map((rule: any, idx: number) => (
                <li key={idx}>{rule.title}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
      {children}
    </MemberCountProvider>
  );
}

function MemberCountDisplay({ slug }: { slug: string }) {
  const { memberCount } = useMemberCount();
  
  return (
    <div className="flex-1 min-w-0">
      <h1 className="text-lg font-bold">r/{slug}</h1>
      <p className="text-xs text-[#818384]">{memberCount} members</p>
    </div>
  );
}
