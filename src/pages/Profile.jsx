const saveProfile = async () => {
  if (!user) return alert('Not logged in')
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    username,
    hobbies: selected,
    updated_at: new Date()
  })
  if (error) alert(error.message)
  else setSaved(true)
}