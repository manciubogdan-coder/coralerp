import nodemailer from 'npm:nodemailer@7.0.11';
Deno.test('dedicated SMTP mailbox accepts a secure connection without sending email', async()=>{
  const pass=Deno.env.get('QUALITY_SMTP_PASSWORD');
  if(!pass) throw new Error('SMTP secret not available in test environment.');
  const transport=nodemailer.createTransport({host:'mail.coral-biogreens.ro',port:465,secure:true,auth:{user:'raport@coral-biogreens.ro',pass},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,logger:false,debug:false});
  try{await transport.verify();}catch{throw new Error('Secure SMTP verification failed.');}finally{transport.close();}
});