import React from 'react';
import { useForm } from 'react-hook-form';

export default function LoginForm({ title, onSubmit }: { title: string, onSubmit: (data: any) => void }) {
  const { register, handleSubmit } = useForm();
  
  return (
    <div className="max-w-md mx-auto p-8 bg-white border rounded-3xl shadow-sm">
      <h1 className="text-2xl font-black mb-6">{title}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2">Username/Email</label>
          <input {...register('username')} className="w-full p-3 border rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Password</label>
          <input type="password" {...register('password')} className="w-full p-3 border rounded-xl" />
        </div>
        <button type="submit" className="w-full py-3 bg-maroon text-white font-bold rounded-xl">
          Login
        </button>
      </form>
    </div>
  );
}
