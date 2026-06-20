"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "../../../lib/auth";
import { useAuthStore } from "../../../stores/auth-store";
import { Shield, Mail, Lock, Building2, Loader2, ArrowRight } from "lucide-react";

// Form validation schema including confirm password matching checks
const registerSchema = z.object({
  orgName: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await register(data.email, data.password, data.orgName);
      setUser(user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Failed to create account. Email may already be in use."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950 p-4">
      {/* Premium Aurora Background Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[130px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-900/15 blur-[140px] pointer-events-none animate-pulse duration-[10000ms]" />
      <div className="absolute top-[30%] right-[30%] w-[25%] h-[25%] rounded-full bg-fuchsia-900/5 blur-[90px] pointer-events-none" />

      {/* Glassmorphic Register Container */}
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 z-10 animate-fade-in relative my-8 border border-slate-900/60 bg-slate-950/40 backdrop-blur-xl shadow-2xl hover:border-purple-500/20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
        
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 mb-3 hover:scale-110 active:scale-95 transition-transform duration-300 cursor-pointer">
            <Shield className="h-6 w-6 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white glow-text">OptiQuery AI</h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">SQL Optimization Engine</p>
        </div>

        <h2 className="text-lg font-bold text-white mb-5 tracking-wide">Create your account</h2>

        {/* Global Error Display */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-red-200 text-sm animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Org Name Field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Organization Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Building2 className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Acme Corporation"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-950/40 border border-slate-900/80 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs transition-all"
                {...formRegister("orgName")}
              />
            </div>
            {errors.orgName && (
              <span className="text-xs text-red-400 mt-1 block font-medium">{errors.orgName.message}</span>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-950/40 border border-slate-900/80 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs transition-all"
                {...formRegister("email")}
              />
            </div>
            {errors.email && (
              <span className="text-xs text-red-400 mt-1 block font-medium">{errors.email.message}</span>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-950/40 border border-slate-900/80 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs transition-all"
                {...formRegister("password")}
              />
            </div>
            {errors.password && (
              <span className="text-xs text-red-400 mt-1 block font-medium">{errors.password.message}</span>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-950/40 border border-slate-900/80 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs transition-all"
                {...formRegister("confirmPassword")}
              />
            </div>
            {errors.confirmPassword && (
              <span className="text-xs text-red-400 mt-1 block font-medium">{errors.confirmPassword.message}</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 btn-premium-primary text-white mt-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Register Account <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-6 pt-5 border-t border-slate-900/60 text-center text-xs text-slate-455 font-medium">
          Already have an account?{" "}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
