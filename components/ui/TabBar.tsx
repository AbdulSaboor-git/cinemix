"use client";
import React from "react";

interface TabBarProps {
  children: React.ReactNode;
  className?: string;
}

export default function TabBar({ children, className = "" }: TabBarProps) {
  return (
    <div
      className={`flex items-center w-full gap-2 overflow-x-auto pb-1 scrollbar-none ${className}`.trim()}
    >
      {children}
    </div>
  );
}
