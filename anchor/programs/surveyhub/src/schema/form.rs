use anchor_lang::prelude::*;

#[account]
pub struct Form {
    pub id: String, // 4 + id.len()
    pub system: Pubkey, //32
    pub owner: Pubkey, // 32
    pub name: String, // 4 + name.len()
    pub description: String, // 4 + description.len()
    pub created_at: i64, // 8
    pub content: String, // 4 + len()
    pub visits: u32, // 4
    pub submissions: u32, // 4
    pub sum_sol: u64, // 8
    pub remain_sol: u64, //8
    pub sol_per_user: u64, // 8
    pub published: bool // 1
}
impl Form {
   pub fn get_current_size(&self) -> usize {
      8 + 4 + self.id.len() + 32 + 32 + 4 + self.name.len() + 4 + self.description.len() + 8 + 4 + self.content.len() + 4 + 4 + 8 + 8 + 8 + 1
   }
   pub fn get_current_content_len(&self) -> usize {
    self.content.len()
   }
}
