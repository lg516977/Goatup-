import React from "react";
import { Link } from "wouter";

export const AuthLayout = ({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl shadow-lg flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary-foreground">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="bg-card border shadow-xl rounded-2xl overflow-hidden relative z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative p-6 sm:p-8">
            {children}
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            A private room for your conversations.
          </p>
        </div>
      </div>
    </div>
  );
};
