'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { useBookStore } from '@/store/bookStore'

export default function HomePage() {
  const { books, fetchBooks, deleteBook } = useBookStore()

  useEffect(() => { fetchBooks() }, [fetchBooks])

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-zinc-800">AI e-Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/objectives"
            className="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors"
          >
            🎯 学习目标库
          </Link>
          <Link
            href="/books/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建课本
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {books.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg">还没有课本</p>
            <p className="text-zinc-400 text-sm mt-1">点击右上角「新建课本」开始创作</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map(book => (
              <div key={book.id} className="group relative bg-white rounded-xl border border-zinc-200 hover:border-blue-300 hover:shadow-md transition-all">
                <Link href={`/books/${book.id}`} className="block p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-12 rounded bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-800 line-clamp-2">{book.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">{book.topic}</p>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{book.audience_grade}</span>
                        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{book.source === 'adaptation' ? '改编' : 'AIGC'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={async () => { if (confirm('确定删除这本课本吗？')) deleteBook(book.id) }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
