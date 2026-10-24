"use client";
import { Search } from "lucide-react";
import { openCommandMenu } from "./CommandMenu";

export function SearchButton() {
  return (
    <button onClick={openCommandMenu} className="btn btn-ghost btn-lg">
      <Search size={15} /> Search
      <span className="kbd ml-1">⌘K</span>
    </button>
  );
}
