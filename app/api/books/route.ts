import { NextRequest, NextResponse } from 'next/server'
import { listBooks, createBook } from '@/lib/db/queries/books'
import { getChapters } from '@/lib/db/queries/books'
import { randomUUID } from 'crypto'

export function GET() {
  const books = listBooks()
  return NextResponse.json(books)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const book = createBook({ id: randomUUID(), ...body })
  return NextResponse.json(book, { status: 201 })
}
