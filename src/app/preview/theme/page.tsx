"use client";

import React, { useState } from "react";
import Badge from "@/components/ui/Badge";
import ThemeToggle from "@/components/ui/ThemeToggle";
import toast from "react-hot-toast";
import { Check, Palette, Type, MousePointer2, Settings2, Tag, Bell, Info, Laptop } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import SearchBar from "@/components/ui/SearchBar";
import VotePill from "@/components/ui/VotePill";
import Pagination from "@/components/ui/Pagination";
import Skeleton from "@/components/ui/Skeleton";

// --- Types ---
type ThemeColor = {
  name: string;
  variable: string;
  swatchClass: string;
  textClass: string;
};

type TextPreviewToken = {
  label: string;
  className: string;
};

// --- Constants ---
const PRIMARY_COLORS: ThemeColor[] = [
  { name: "Primary", variable: "--color-primary", swatchClass: "bg-primary", textClass: "text-primary" },
  { name: "Secondary", variable: "--color-secondary", swatchClass: "bg-secondary", textClass: "text-secondary" },
  { name: "Accent", variable: "--color-accent", swatchClass: "bg-accent", textClass: "text-accent" },
  { name: "Neutral", variable: "--color-neutral", swatchClass: "bg-neutral", textClass: "text-neutral" },
];

const GENERAL_COLORS: ThemeColor[] = [
  { name: "Blue", variable: "--color-blue", swatchClass: "bg-[var(--color-blue)]", textClass: "text-[var(--color-blue)]" },
  { name: "Green", variable: "--color-green", swatchClass: "bg-[var(--color-green)]", textClass: "text-[var(--color-green)]" },
  { name: "Red", variable: "--color-red", swatchClass: "bg-[var(--color-red)]", textClass: "text-[var(--color-red)]" },
  { name: "Yellow", variable: "--color-yellow", swatchClass: "bg-[var(--color-yellow)]", textClass: "text-[var(--color-yellow)]" },
  { name: "Purple", variable: "--color-purple", swatchClass: "bg-[var(--color-purple)]", textClass: "text-[var(--color-purple)]" },
  { name: "Orange", variable: "--color-orange", swatchClass: "bg-[var(--color-orange)]", textClass: "text-[var(--color-orange)]" },
];

const STATE_COLORS: ThemeColor[] = [
  { name: "Info", variable: "--color-info", swatchClass: "bg-info", textClass: "text-info" },
  { name: "Success", variable: "--color-success", swatchClass: "bg-success", textClass: "text-success" },
  { name: "Warning", variable: "--color-warning", swatchClass: "bg-warning", textClass: "text-warning" },
  { name: "Error", variable: "--color-error", swatchClass: "bg-error", textClass: "text-error" },
];

const TEXT_PREVIEW_TOKENS: TextPreviewToken[] = [
  { label: "text-primary", className: "text-primary" },
  { label: "text-secondary", className: "text-secondary" },
  { label: "text-accent", className: "text-accent" },
  { label: "text-neutral", className: "text-neutral" },
  { label: "text-info", className: "text-info" },
  { label: "text-success", className: "text-success" },
  { label: "text-warning", className: "text-warning" },
  { label: "text-error", className: "text-error" },
  { label: "text-base-content", className: "text-base-content" },
  { label: "text-base-content/80", className: "text-base-content/80" },
  { label: "text-base-content/60", className: "text-base-content/60" },
  { label: "text-primary-content", className: "text-primary-content bg-primary rounded px-2 py-1" },
];

export default function ThemePreviewPage() {
  const [activeTab, setActiveTab] = useState("colors");

  return (
    <div className="bg-base-100 text-base-content min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-base-300 mb-10 flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-black tracking-tight">
              <Palette className="text-primary h-10 w-10" />
              Theme Preview
            </h1>
            <p className="mt-2 opacity-70">
              Preview DaisyUI theme tokens and components with live light/dark switching.
            </p>
          </div>
          <div>
            <ThemeToggle />
          </div>
        </header>

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-base-200 mb-8 p-1">
          <button
            className={`tab gap-2 ${activeTab === "colors" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("colors")}
          >
            <Palette size={16} />
            Colors
          </button>
          <button
            className={`tab gap-2 ${activeTab === "buttons" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("buttons")}
          >
            <MousePointer2 size={16} />
            Buttons
          </button>
          <button
            className={`tab gap-2 ${activeTab === "inputs" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("inputs")}
          >
            <Settings2 size={16} />
            Inputs
          </button>
          <button
            className={`tab gap-2 ${activeTab === "badges" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("badges")}
          >
            <Tag size={16} />
            Badges
          </button>
          <button
            className={`tab gap-2 ${activeTab === "typography" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("typography")}
          >
            <Type size={16} />
            Typography & Links
          </button>
          <button
            className={`tab gap-2 ${activeTab === "feedback" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("feedback")}
          >
            <Bell size={16} />
            Feedback
          </button>
          <button
            className={`tab gap-2 ${activeTab === "components" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("components")}
          >
            <Laptop size={16} />
            Components
          </button>
        </div>

        {/* Content Sections */}
        <div className="space-y-12">
          {/* Colors Section */}
          {activeTab === "colors" && (
            <section className="animate-in fade-in grid grid-cols-1 gap-8 duration-300 md:grid-cols-2">
              <div className="card bg-base-200 overflow-hidden shadow-xl">
                <div className="bg-primary text-primary-content flex items-center justify-between p-4 font-bold">
                  <span>Brand Colors</span>
                  <Palette size={20} />
                </div>
                <div className="space-y-4 p-6">
                  {PRIMARY_COLORS.map((color) => (
                    <div key={color.variable} className="flex items-center gap-4">
                      <div
                        className={`border-base-300 h-12 w-12 flex-shrink-0 rounded-lg border-2 shadow-inner ${color.swatchClass}`}
                      />
                      <div className="flex-grow">
                        <div className="text-sm font-bold">{color.name}</div>
                        <div className={`font-mono text-xs font-bold ${color.textClass}`}>
                          {color.variable}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card bg-base-200 overflow-hidden shadow-xl">
                <div className="bg-info text-info-content flex items-center justify-between p-4 font-bold">
                  <span>State Colors</span>
                  <Settings2 size={20} />
                </div>
                <div className="space-y-4 p-6">
                  {STATE_COLORS.map((color) => (
                    <div key={color.variable} className="flex items-center gap-4">
                      <div
                        className={`border-base-300 h-12 w-12 flex-shrink-0 rounded-lg border-2 shadow-inner ${color.swatchClass}`}
                      />
                      <div className="flex-grow">
                        <div className="text-sm font-bold">{color.name}</div>
                        <div className={`font-mono text-xs font-bold ${color.textClass}`}>
                          {color.variable}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* General Colors */}
              <div className="card bg-base-200 overflow-hidden shadow-xl md:col-span-2">
                <div className="bg-neutral text-neutral-content flex items-center justify-between p-4 font-bold">
                  <span>General Colors</span>
                  <Info size={20} />
                </div>
                <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 lg:grid-cols-6">
                  {GENERAL_COLORS.map((color) => (
                    <div key={color.variable} className="flex flex-col items-center gap-2">
                      <div
                        className={`border-base-300 h-14 w-full rounded-lg border-2 shadow-inner ${color.swatchClass}`}
                      />
                      <div className="text-center">
                        <div className="text-sm font-bold">{color.name}</div>
                        <div className={`font-mono text-xs font-bold ${color.textClass}`}>
                          {color.variable}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card bg-base-200 overflow-hidden shadow-xl md:col-span-2">
                <div className="bg-base-300 text-base-content flex items-center justify-between p-4 font-bold">
                  <span>Text Utility Classes</span>
                  <Type size={20} />
                </div>
                <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
                  {TEXT_PREVIEW_TOKENS.map((token) => (
                    <div key={token.label} className="bg-base-100 border-base-300 rounded-lg border p-3">
                      <p className={`text-base font-semibold ${token.className}`}>
                        The quick brown fox jumps over the lazy dog.
                      </p>
                      <p className="font-mono text-xs opacity-70">{token.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Buttons Section */}
          {activeTab === "buttons" && (
            <section className="animate-in fade-in space-y-8 duration-300">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="card bg-base-200 p-8 shadow-sm">
                  <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">Variants</h3>
                  <div className="flex flex-wrap gap-4">
                    <button className="btn">Default</button>
                    <button className="btn btn-primary">Primary</button>
                    <button className="btn btn-secondary">Secondary</button>
                    <button className="btn btn-accent">Accent</button>
                    <button className="btn btn-ghost">Ghost</button>
                    <button className="btn btn-link">Link</button>
                    <button className="btn btn-info">Info</button>
                    <button className="btn btn-success">Success</button>
                    <button className="btn btn-warning">Warning</button>
                    <button className="btn btn-error">Error</button>
                    <button className="btn border-none bg-[var(--color-blue)] text-white">
                      Blue (Custom)
                    </button>
                  </div>
                </div>

                <div className="card bg-base-200 p-8 shadow-sm">
                  <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">Outlined</h3>
                  <div className="flex flex-wrap gap-4">
                    <button className="btn btn-outline">Default</button>
                    <button className="btn btn-outline btn-primary">Primary</button>
                    <button className="btn btn-outline btn-secondary">Secondary</button>
                    <button className="btn btn-outline btn-accent">Accent</button>
                  </div>
                </div>

                <div className="card bg-base-200 p-8 shadow-sm">
                  <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">Sizes</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <button className="btn btn-lg">Large</button>
                    <button className="btn">Normal</button>
                    <button className="btn btn-sm">Small</button>
                    <button className="btn btn-xs">Tiny</button>
                  </div>
                </div>

                <div className="card bg-base-200 p-8 shadow-sm">
                  <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">States</h3>
                  <div className="flex flex-wrap gap-4">
                    <button className="btn btn-disabled">Disabled</button>
                    <button className="btn btn-primary loading">Loading</button>
                    <button className="btn no-animation">No Animation</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Inputs Section */}
          {activeTab === "inputs" && (
            <section className="animate-in fade-in grid grid-cols-1 gap-8 duration-300 md:grid-cols-2">
              <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                <h3 className="border-base-300 border-b pb-2 text-lg font-bold">Text Inputs</h3>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">What is your name?</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Type here"
                    className="input input-bordered w-full"
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Primary input</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Type here"
                    className="input input-bordered input-primary w-full"
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Ghost input</span>
                  </label>
                  <input type="text" placeholder="Type here" className="input input-ghost w-full" />
                </div>
              </div>

              <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                <h3 className="border-base-300 border-b pb-2 text-lg font-bold">Selection</h3>
                <div className="flex flex-wrap gap-8">
                  <div className="flex flex-col gap-4">
                    <label className="label-text font-bold">Checkbox</label>
                    <input type="checkbox" defaultChecked className="checkbox" />
                    <input type="checkbox" defaultChecked className="checkbox checkbox-primary" />
                    <input type="checkbox" defaultChecked className="checkbox checkbox-secondary" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="label-text font-bold">Toggle</label>
                    <input type="checkbox" className="toggle" />
                    <input type="checkbox" defaultChecked className="toggle toggle-primary" />
                    <input type="checkbox" defaultChecked className="toggle toggle-secondary" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="label-text font-bold">Radio</label>
                    <input type="radio" name="radio-1" className="radio" defaultChecked />
                    <input type="radio" name="radio-1" className="radio radio-primary" />
                    <input type="radio" name="radio-1" className="radio radio-secondary" />
                  </div>
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Select Box</span>
                  </label>
                  <select className="select select-bordered">
                    <option disabled selected>
                      Pick one
                    </option>
                    <option>Star Wars</option>
                    <option>Harry Potter</option>
                    <option>Lord of the Rings</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* Badges Section */}
          {activeTab === "badges" && (
            <section className="animate-in fade-in space-y-8 duration-300">
              <div className="card bg-base-200 p-8 shadow-sm">
                <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">
                  Custom Project Badges
                </h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Badge variant="flair">Discussion</Badge>
                  <Badge variant="flair">News</Badge>
                  <Badge variant="ai" />
                  <Badge variant="mod" />
                  <Badge variant="nsfw" />
                  <Badge variant="spoiler" />
                </div>
              </div>

              <div className="card bg-base-200 p-8 shadow-sm">
                <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">
                  DaisyUI Standard Badges
                </h3>
                <div className="flex flex-wrap gap-4">
                  <div className="badge">default</div>
                  <div className="badge badge-primary">primary</div>
                  <div className="badge badge-secondary">secondary</div>
                  <div className="badge badge-accent">accent</div>
                  <div className="badge badge-ghost">ghost</div>
                  <div className="badge badge-info gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="inline-block h-4 w-4 stroke-current"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                    info
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Typography Section */}
          {activeTab === "typography" && (
            <section className="animate-in fade-in space-y-8 duration-300">
              <div className="card bg-base-200 p-10 shadow-sm">
                <div className="mx-auto max-w-4xl space-y-10">
                  <div className="border-base-300 border-b pb-4">
                    <h3 className="mb-2 font-mono text-xs opacity-50">
                      Title Font (--font-display / --title)
                    </h3>
                    <h1 className="text-primary mb-2 text-5xl font-black">
                      Heading 1 - The Quick Brown Fox
                    </h1>
                    <h2 className="mb-2 text-3xl font-bold">Heading 2 - Jumps Over The Lazy Dog</h2>
                    <h3 className="text-xl font-semibold">
                      Heading 3 - Grumpy Wizards Make Toxic Brew
                    </h3>
                  </div>

                  <div>
                    <h3 className="mb-4 font-mono text-xs opacity-50">
                      Body Font (--font-body / --text)
                    </h3>
                    <p className="mb-6 text-lg leading-relaxed font-medium">
                      This is a subtitle or lead text. It uses the body font but with a slightly
                      larger size and medium weight.
                    </p>
                    <p className="mb-6 text-base leading-relaxed">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                      incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                      nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <p className="text-sm opacity-70">
                      This is smaller text (--text-sm) often used for footnotes or secondary
                      information. It should still be perfectly readable.
                    </p>
                  </div>

                  <div className="bg-base-300 overflow-x-auto rounded-lg p-6 font-mono text-sm">
                    <code>
                      {`.example {
  font-family: var(--font-body);
  color: var(--color-primary);
  background: var(--color-base-200);
}`}
                    </code>
                  </div>
                </div>
              </div>

              <div className="card bg-base-200 p-10 shadow-sm">
                <div className="mx-auto max-w-4xl">
                  <h3 className="border-base-300 mb-6 border-b pb-2 text-lg font-bold">Links</h3>
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold opacity-50">Basic Styles</h4>
                      <div className="flex flex-col gap-2">
                        <a className="link">Default Link</a>
                        <a className="link link-hover">Link with Hover only</a>
                        <p>
                          Text with a <a className="link">link</a> inside.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-bold opacity-50">Brand Colors</h4>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <a className="link link-primary">Primary</a>
                        <a className="link link-secondary">Secondary</a>
                        <a className="link link-accent">Accent</a>
                        <a className="link link-neutral">Neutral</a>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-bold opacity-50">State Colors</h4>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <a className="link link-info">Info</a>
                        <a className="link link-success">Success</a>
                        <a className="link link-warning">Warning</a>
                        <a className="link link-error">Error</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          {/* Feedback Section */}
          {activeTab === "feedback" && (
            <section className="animate-in fade-in space-y-12 duration-300">
              <div className="space-y-6">
                <h3 className="border-base-300 border-b pb-2 text-lg font-bold">
                  Toast Notifications (react-hot-toast)
                </h3>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => toast.success("Successfully saved!")}
                    className="btn btn-success"
                  >
                    Success Toast
                  </button>
                  <button
                    onClick={() => toast.error("This is an error!")}
                    className="btn btn-error"
                  >
                    Error Toast
                  </button>
                  <button onClick={() => toast("Hello world!")} className="btn btn-info">
                    Default Toast
                  </button>
                  <button
                    onClick={() => {
                      const toastId = toast.loading("Loading...");
                      setTimeout(() => {
                        toast.success("Loaded!", { id: toastId });
                      }, 2000);
                    }}
                    className="btn btn-ghost border-base-300"
                  >
                    Loading Toast
                  </button>
                  <button
                    onClick={() =>
                      toast.success("Custom Styled Toast!", {
                        style: {
                          border: "1px solid var(--color-primary)",
                          padding: "16px",
                          color: "var(--color-primary)",
                          background: "var(--color-base-100)",
                        },
                        iconTheme: {
                          primary: "var(--color-primary)",
                          secondary: "var(--color-primary-content)",
                        },
                      })
                    }
                    className="btn btn-outline btn-primary"
                  >
                    Custom Theme Toast
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="border-base-300 border-b pb-2 text-lg font-bold">DaisyUI Alerts</h3>
                <div className="space-y-4">
                  <div className="alert shadow-lg">
                    <Info className="text-info h-6 w-6" />
                    <div>
                      <h3 className="font-bold">New message!</h3>
                      <div className="text-xs">You have 1 unread message</div>
                    </div>
                    <button className="btn btn-sm">See</button>
                  </div>

                  <div className="alert alert-success shadow-lg">
                    <Check className="h-6 w-6" />
                    <span>Your purchase has been confirmed!</span>
                  </div>

                  <div className="alert alert-warning shadow-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 shrink-0 stroke-current"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>Warning: Invalid email address!</span>
                  </div>

                  <div className="alert alert-error shadow-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 shrink-0 stroke-current"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Error! Task failed successfully.</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Components Section */}
          {activeTab === "components" && (
            <section className="animate-in fade-in space-y-12 duration-300">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Avatar Preview */}
                <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                  <h3 className="border-base-300 border-b pb-2 text-lg font-bold">Avatars</h3>
                  <div className="flex flex-wrap items-end gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <Avatar fallbackSeed="neven" size="lg" isPersona />
                      <span className="text-xs opacity-50">Large AI</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <Avatar fallbackSeed="neven" size="md" />
                      <span className="text-xs opacity-50">Medium</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <Avatar fallbackSeed="neven" size="sm" />
                      <span className="text-xs opacity-50">Small</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <Avatar fallbackSeed="neven" size="xs" />
                      <span className="text-xs opacity-50">Tiny</span>
                    </div>
                  </div>
                </div>

                {/* VotePill Preview */}
                <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                  <h3 className="border-base-300 border-b pb-2 text-lg font-bold">VotePill</h3>
                  <div className="flex flex-wrap items-center gap-8">
                    <div className="flex flex-col gap-4">
                      <span className="text-xs opacity-50">Horizontal</span>
                      <VotePill score={1250} userVote={1} onVote={() => {}} />
                      <VotePill score={42} userVote={-1} onVote={() => {}} />
                      <VotePill score={0} onVote={() => {}} />
                    </div>
                    <div className="flex flex-col gap-4">
                      <span className="text-xs opacity-50">Vertical</span>
                      <div className="flex gap-4">
                        <VotePill
                          score={1250}
                          userVote={1}
                          onVote={() => {}}
                          orientation="vertical"
                        />
                        <VotePill
                          score={42}
                          userVote={-1}
                          onVote={() => {}}
                          orientation="vertical"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SearchBar Preview */}
                <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                  <h3 className="border-base-300 border-b pb-2 text-lg font-bold">SearchBar</h3>
                  <div className="space-y-4">
                    <div className="bg-base-100 flex items-center justify-between rounded-lg p-4">
                      <span className="text-sm">Default State:</span>
                      <SearchBar value="" onChange={() => {}} />
                    </div>
                    <div className="bg-base-100 flex items-center justify-between rounded-lg p-4">
                      <span className="text-sm">With Value:</span>
                      <SearchBar value="searching..." onChange={() => {}} />
                    </div>
                  </div>
                </div>

                {/* Skeleton Preview */}
                <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                  <h3 className="border-base-300 border-b pb-2 text-lg font-bold">Skeletons</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Skeleton variant="circular" className="h-12 w-12" />
                      <div className="flex-grow space-y-2">
                        <Skeleton variant="text" className="w-1/2" />
                        <Skeleton variant="text" />
                      </div>
                    </div>
                    <Skeleton variant="rectangular" className="h-24 w-full" />
                  </div>
                </div>
              </div>

              {/* Pagination Preview */}
              <div className="card bg-base-200 space-y-6 p-8 shadow-sm">
                <h3 className="border-base-300 border-b pb-2 text-lg font-bold">Pagination</h3>
                <div className="space-y-8">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs opacity-50">Default (Small)</span>
                    <Pagination page={3} totalPages={10} hrefForPage={(p) => `#page-${p}`} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs opacity-50">Medium</span>
                    <Pagination
                      page={1}
                      totalPages={5}
                      hrefForPage={(p) => `#page-${p}`}
                      size="md"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <footer className="border-base-300 mt-20 border-t pt-10 text-center text-sm opacity-50">
          <p>Handcrafted for LLMBook Project &bull; 2026</p>
        </footer>
      </div>
    </div>
  );
}
