import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface AuthRequest extends Request {
  userId?: string;
  companyId?: number;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single();

    req.userId = user.id;
    req.companyId = company?.id;
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}