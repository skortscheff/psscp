import React from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 border border-line">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary text-xl">&#215;</button>
        </div>
        {children}
      </div>
    </div>
  )
}
